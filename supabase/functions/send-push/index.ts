import {
  createClient
} from "npm:@supabase/supabase-js@2";


import {
  buildPushHTTPRequest
} from "npm:@pushforge/builder@2.0.5";


/* =========================================================
   ACL SEND PUSH EDGE FUNCTION
   Version: 1.0.0
========================================================= */

const corsHeaders = {
  "Access-Control-Allow-Origin":
    "*",

  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",

  "Access-Control-Allow-Methods":
    "POST, OPTIONS"
};


const jsonHeaders = {
  ...corsHeaders,

  "Content-Type":
    "application/json; charset=utf-8"
};


/* =========================================================
   TYPES
========================================================= */

type PushRequestBody = {
  title?: string;
  body?: string;
  url?: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  type?: string;
  edition?: "basic" | "expert" | null;
  user_ids?: string[];
  requireInteraction?: boolean;
  data?: Record<string, unknown>;
};


type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  edition: string | null;
  is_active: boolean;
};


type PushResult = {
  subscriptionId: string;
  userId: string;
  success: boolean;
  status: number;
  error?: string;
};


/* =========================================================
   RESPONSE HELPERS
========================================================= */

function jsonResponse(
  payload: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(
      payload
    ),
    {
      status,
      headers:
        jsonHeaders
    }
  );
}


function errorResponse(
  message: string,
  status = 400,
  details?: unknown
) {
  return jsonResponse(
    {
      success:
        false,

      message,

      details:
        details ?? null
    },
    status
  );
}


/* =========================================================
   TEXT HELPERS
========================================================= */

function cleanText(
  value: unknown,
  fallback = "",
  maximumLength = 500
) {
  const text =
    String(
      value ??
      fallback
    )
      .trim()
      .slice(
        0,
        maximumLength
      );


  return text ||
    fallback;
}


function normalizeEdition(
  value: unknown
): "basic" | "expert" | null {
  const edition =
    String(
      value ??
      ""
    )
      .trim()
      .toLowerCase();


  if (
    edition ===
    "basic"
  ) {
    return "basic";
  }


  if (
    edition ===
    "expert"
  ) {
    return "expert";
  }


  return null;
}


function normalizeUserIds(
  value: unknown
) {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }


  return [
    ...new Set(
      value
        .map(
          (
            item
          ) =>
            String(
              item ??
              ""
            ).trim()
        )
        .filter(
          Boolean
        )
    )
  ].slice(
    0,
    1000
  );
}


/* =========================================================
   URL SAFETY
========================================================= */

function safeActionUrl(
  value: unknown
) {
  const fallback =
    "/Cardiology/notifications.html";


  const supplied =
    String(
      value ??
      fallback
    ).trim();


  try {
    const parsed =
      new URL(
        supplied,
        "https://drmohamedalaa90.github.io"
      );


    if (
      parsed.hostname !==
      "drmohamedalaa90.github.io"
    ) {
      return fallback;
    }


    if (
      !parsed.pathname.startsWith(
        "/Cardiology/"
      )
    ) {
      return fallback;
    }


    return (
      `${parsed.pathname}` +
      `${parsed.search}` +
      `${parsed.hash}`
    );
  } catch {
    return fallback;
  }
}


/* =========================================================
   BASE64URL HELPERS
========================================================= */

function base64UrlToBytes(
  value: string
) {
  const normalized =
    value
      .replace(
        /-/g,
        "+"
      )
      .replace(
        /_/g,
        "/"
      );


  const padding =
    "=".repeat(
      (
        4 -
        (
          normalized.length %
          4
        )
      ) %
      4
    );


  const binary =
    atob(
      normalized +
      padding
    );


  return Uint8Array.from(
    binary,
    (
      character
    ) =>
      character.charCodeAt(
        0
      )
  );
}


function bytesToBase64Url(
  bytes: Uint8Array
) {
  let binary =
    "";


  for (
    const byte of
    bytes
  ) {
    binary +=
      String.fromCharCode(
        byte
      );
  }


  return btoa(
    binary
  )
    .replace(
      /\+/g,
      "-"
    )
    .replace(
      /\//g,
      "_"
    )
    .replace(
      /=+$/g,
      ""
    );
}


/* =========================================================
   VAPID JWK
========================================================= */

function createPrivateJwk(
  publicKey: string,
  privateKey: string
) {
  const publicBytes =
    base64UrlToBytes(
      publicKey
    );


  /*
   * A Web Push P-256 public key contains:
   *
   * Byte 0: 04
   * Bytes 1–32: X coordinate
   * Bytes 33–64: Y coordinate
   */

  if (
    publicBytes.length !==
      65 ||
    publicBytes[
      0
    ] !==
      4
  ) {
    throw new Error(
      "The VAPID public key is invalid."
    );
  }


  const x =
    publicBytes.slice(
      1,
      33
    );


  const y =
    publicBytes.slice(
      33,
      65
    );


  return {
    kty:
      "EC",

    crv:
      "P-256",

    x:
      bytesToBase64Url(
        x
      ),

    y:
      bytesToBase64Url(
        y
      ),

    d:
      privateKey,

    ext:
      true,

    key_ops: [
      "sign"
    ]
  };
}


/* =========================================================
   BATCH HELPER
========================================================= */

async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  worker: (
    item: T
  ) => Promise<R>
) {
  const results: R[] =
    [];


  for (
    let index = 0;
    index <
    items.length;
    index +=
    batchSize
  ) {
    const batch =
      items.slice(
        index,
        index +
        batchSize
      );


    const batchResults =
      await Promise.all(
        batch.map(
          worker
        )
      );


    results.push(
      ...batchResults
    );
  }


  return results;
}


/* =========================================================
   MAIN REQUEST
========================================================= */

Deno.serve(
  async (
    request
  ) => {
    if (
      request.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers:
            corsHeaders
        }
      );
    }


    if (
      request.method !==
      "POST"
    ) {
      return errorResponse(
        "Method not allowed.",
        405
      );
    }


    try {
      /* ===================================================
         ENVIRONMENT
      =================================================== */

      const supabaseUrl =
        Deno.env.get(
          "SUPABASE_URL"
        );


      const supabaseAnonKey =
        Deno.env.get(
          "SUPABASE_ANON_KEY"
        );


      const serviceRoleKey =
        Deno.env.get(
          "SUPABASE_SERVICE_ROLE_KEY"
        );


      const vapidPublicKey =
        Deno.env.get(
          "VAPID_PUBLIC_KEY"
        );


      const vapidPrivateKey =
        Deno.env.get(
          "VAPID_PRIVATE_KEY"
        );


      const vapidSubject =
        Deno.env.get(
          "VAPID_SUBJECT"
        );


      if (
        !supabaseUrl ||
        !supabaseAnonKey ||
        !serviceRoleKey
      ) {
        return errorResponse(
          "Supabase environment variables are missing.",
          500
        );
      }


      if (
        !vapidPublicKey ||
        !vapidPrivateKey ||
        !vapidSubject
      ) {
        return errorResponse(
          "VAPID secrets are missing.",
          500
        );
      }


      /* ===================================================
         AUTHENTICATE CALLER
      =================================================== */

      const authorization =
        request.headers.get(
          "Authorization"
        );


      if (!authorization) {
        return errorResponse(
          "Authorization is required.",
          401
        );
      }


      const userClient =
        createClient(
          supabaseUrl,
          supabaseAnonKey,
          {
            global: {
              headers: {
                Authorization:
                  authorization
              }
            },

            auth: {
              persistSession:
                false,

              autoRefreshToken:
                false
            }
          }
        );


      const {
        data:
          userData,

        error:
          userError
      } =
        await userClient
          .auth
          .getUser();


      if (
        userError ||
        !userData?.user
      ) {
        return errorResponse(
          "The authenticated user could not be verified.",
          401,
          userError?.message
        );
      }


      const adminClient =
        createClient(
          supabaseUrl,
          serviceRoleKey,
          {
            auth: {
              persistSession:
                false,

              autoRefreshToken:
                false
            }
          }
        );


      const {
        data:
          profile,

        error:
          profileError
      } =
        await adminClient
          .from(
            "profiles"
          )
          .select(
            "id, role"
          )
          .eq(
            "id",
            userData.user.id
          )
          .maybeSingle();


      if (profileError) {
        return errorResponse(
          "The administrator profile could not be checked.",
          500,
          profileError.message
        );
      }


      const role =
        String(
          profile?.role ??
          ""
        )
          .trim()
          .toLowerCase();


      if (
        role !==
          "admin" &&
        role !==
          "administrator"
      ) {
        return errorResponse(
          "Administrator access is required.",
          403
        );
      }


      /* ===================================================
         REQUEST BODY
      =================================================== */

      let requestBody:
        PushRequestBody;


      try {
        requestBody =
          await request.json();
      } catch {
        return errorResponse(
          "A valid JSON request body is required.",
          400
        );
      }


      const title =
        cleanText(
          requestBody.title,
          "Alexandria Cardiology League",
          120
        );


      const body =
        cleanText(
          requestBody.body,
          "You have a new ACL notification.",
          500
        );


      const edition =
        normalizeEdition(
          requestBody.edition
        );


      const userIds =
        normalizeUserIds(
          requestBody.user_ids
        );


      const actionUrl =
        safeActionUrl(
          requestBody.url
        );


      const notificationType =
        cleanText(
          requestBody.type,
          "announcement",
          50
        );


      const tag =
        cleanText(
          requestBody.tag,
          `acl-${Date.now()}`,
          100
        );


      /* ===================================================
         LOAD SUBSCRIPTIONS
      =================================================== */

      let subscriptionQuery =
        adminClient
          .from(
            "push_subscriptions"
          )
          .select(`
            id,
            user_id,
            endpoint,
            p256dh,
            auth,
            edition,
            is_active
          `)
          .eq(
            "is_active",
            true
          );


      if (
        userIds.length
      ) {
        subscriptionQuery =
          subscriptionQuery.in(
            "user_id",
            userIds
          );
      } else if (
        edition
      ) {
        subscriptionQuery =
          subscriptionQuery.eq(
            "edition",
            edition
          );
      }


      const {
        data:
          subscriptionData,

        error:
          subscriptionError
      } =
        await subscriptionQuery;


      if (subscriptionError) {
        return errorResponse(
          "Push subscriptions could not be loaded.",
          500,
          subscriptionError.message
        );
      }


      const subscriptions =
        (
          subscriptionData ??
          []
        ) as PushSubscriptionRow[];


      if (
        !subscriptions.length
      ) {
        return jsonResponse({
          success:
            true,

          message:
            "No active push subscriptions matched the selected audience.",

          audience: {
            edition,

            userIds
          },

          total:
            0,

          sent:
            0,

          failed:
            0
        });
      }


      /* ===================================================
         PREPARE VAPID KEY
      =================================================== */

      const privateJwk =
        createPrivateJwk(
          vapidPublicKey,
          vapidPrivateKey
        );


      /* ===================================================
         SEND PUSH MESSAGES
      =================================================== */

      const results =
        await processInBatches<
          PushSubscriptionRow,
          PushResult
        >(
          subscriptions,
          20,
          async (
            subscription
          ) => {
            try {
              const pushPayload = {
                title,

                body,

                icon:
                  cleanText(
                    requestBody.icon,
                    "/Cardiology/assets/images/acl-icon-192.png",
                    500
                  ),

                badge:
                  cleanText(
                    requestBody.badge,
                    "/Cardiology/assets/images/acl-icon-192.png",
                    500
                  ),

                image:
                  cleanText(
                    requestBody.image,
                    "",
                    500
                  ) ||
                  undefined,

                tag,

                type:
                  notificationType,

                edition,

                notification_id:
                  crypto.randomUUID(),

                requireInteraction:
                  Boolean(
                    requestBody.requireInteraction
                  ),

                url:
                  actionUrl,

                data: {
                  ...(
                    requestBody.data ??
                    {}
                  ),

                  url:
                    actionUrl,

                  edition,

                  type:
                    notificationType
                }
              };


              const {
                endpoint,
                headers,
                body:
                  encryptedBody
              } =
                await buildPushHTTPRequest({
                  privateJWK:
                    privateJwk,

                  subscription: {
                    endpoint:
                      subscription.endpoint,

                    keys: {
                      p256dh:
                        subscription.p256dh,

                      auth:
                        subscription.auth
                    }
                  },

                  message: {
                    payload:
                      pushPayload,

                    adminContact:
                      vapidSubject,

                    options: {
                      ttl:
                        60 *
                        60 *
                        24,

                      urgency:
                        "high",

                      topic:
                        tag.slice(
                          0,
                          32
                        )
                    }
                  }
                });


              const pushResponse =
                await fetch(
                  endpoint,
                  {
                    method:
                      "POST",

                    headers,

                    body:
                      encryptedBody
                  }
                );


              if (
                pushResponse.ok
              ) {
                return {
                  subscriptionId:
                    subscription.id,

                  userId:
                    subscription.user_id,

                  success:
                    true,

                  status:
                    pushResponse.status
                };
              }


              const responseText =
                await pushResponse
                  .text();


              /*
               * 404 and 410 usually mean that the browser
               * subscription has expired or was removed.
               */

              if (
                pushResponse.status ===
                  404 ||
                pushResponse.status ===
                  410
              ) {
                await adminClient
                  .from(
                    "push_subscriptions"
                  )
                  .update({
                    is_active:
                      false,

                    updated_at:
                      new Date()
                        .toISOString()
                  })
                  .eq(
                    "id",
                    subscription.id
                  );
              }


              return {
                subscriptionId:
                  subscription.id,

                userId:
                  subscription.user_id,

                success:
                  false,

                status:
                  pushResponse.status,

                error:
                  responseText ||
                  pushResponse.statusText
              };
            } catch (
              error
            ) {
              return {
                subscriptionId:
                  subscription.id,

                userId:
                  subscription.user_id,

                success:
                  false,

                status:
                  0,

                error:
                  error instanceof
                    Error
                    ? error.message
                    : String(
                        error
                      )
              };
            }
          }
        );


      const successfulResults =
        results.filter(
          (
            result
          ) =>
            result.success
        );


      const failedResults =
        results.filter(
          (
            result
          ) =>
            !result.success
        );


      return jsonResponse({
        success:
          failedResults.length ===
          0,

        message:
          failedResults.length
            ? "Push delivery completed with some failures."
            : "Push notification sent successfully.",

        audience: {
          edition,

          userIds
        },

        notification: {
          title,

          body,

          url:
            actionUrl,

          type:
            notificationType,

          tag
        },

        total:
          results.length,

        sent:
          successfulResults.length,

        failed:
          failedResults.length,

        failures:
          failedResults.slice(
            0,
            20
          )
      });
    } catch (
      error
    ) {
      console.error(
        "SEND PUSH FUNCTION ERROR:",
        error
      );


      return errorResponse(
        error instanceof
          Error
          ? error.message
          : "An unexpected push notification error occurred.",
        500
      );
    }
  }
);
