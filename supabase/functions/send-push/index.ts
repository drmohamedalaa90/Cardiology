import {
  createClient
} from "npm:@supabase/supabase-js@2";


import {
  buildPushHTTPRequest
} from "npm:@pushforge/builder@2.0.5";


/* =========================================================
   ACL SEND PUSH EDGE FUNCTION
   Version: 1.1.0

   Improvements:
   - Preserves multi-device subscriptions
   - Automatically deactivates expired 404/410 endpoints
   - Reports deactivated subscriptions separately
   - Returns useful failure reasons to the admin page
   - Adds request timeout protection
   - Prevents one failed endpoint from stopping the batch
   - Uses one notification ID for the whole announcement
========================================================= */


/* =========================================================
   CONSTANTS
========================================================= */

const MAX_SELECTED_USERS =
  1000;


const DELIVERY_BATCH_SIZE =
  20;


const DELIVERY_TIMEOUT_MS =
  15000;


const MAX_FAILURES_IN_RESPONSE =
  30;


const DEFAULT_ICON =
  "/Cardiology/assets/images/acl-icon-192.png";


const DEFAULT_ACTION_URL =
  "/Cardiology/notifications.html";


const ALLOWED_NOTIFICATION_HOSTS =
  new Set([
    "drmohamedalaa90.github.io",
    "acl.drmohamedalaa.org"
  ]);


/* =========================================================
   HEADERS
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

type AclEdition =
  "basic" |
  "expert" |
  null;


type PushRequestBody = {
  title?: string;
  body?: string;
  url?: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  type?: string;
  edition?: AclEdition;
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
  endpointHost: string;
  success: boolean;
  status: number;
  statusText: string;
  deactivated: boolean;
  error?: string;
  deactivationError?: string;
};


type Environment = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  serviceRoleKey: string;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;
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
        details ??
        null
    },
    status
  );
}


/* =========================================================
   ENVIRONMENT
========================================================= */

function readRequiredEnvironment():
  Environment {
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
    throw new Error(
      "Required Supabase environment variables are missing."
    );
  }


  if (
    !vapidPublicKey ||
    !vapidPrivateKey ||
    !vapidSubject
  ) {
    throw new Error(
      "Required VAPID secrets are missing."
    );
  }


  return {
    supabaseUrl,
    supabaseAnonKey,
    serviceRoleKey,
    vapidPublicKey,
    vapidPrivateKey,
    vapidSubject
  };
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


  return (
    text ||
    fallback
  );
}


function truncateText(
  value: unknown,
  maximumLength = 500
) {
  const text =
    String(
      value ??
      ""
    ).trim();


  if (
    text.length <=
    maximumLength
  ) {
    return text;
  }


  return (
    `${text.slice(
      0,
      maximumLength
    )}…`
  );
}


function normalizeEdition(
  value: unknown
): AclEdition {
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
    MAX_SELECTED_USERS
  );
}


function normalizeNotificationType(
  value: unknown
) {
  const type =
    cleanText(
      value,
      "announcement",
      50
    )
      .toLowerCase()
      .replace(
        /[^a-z0-9_-]/g,
        "-"
      );


  return (
    type ||
    "announcement"
  );
}


function normalizeTopic(
  value: unknown
) {
  const topic =
    cleanText(
      value,
      `acl-${Date.now()}`,
      100
    )
      .replace(
        /[^A-Za-z0-9_-]/g,
        "-"
      )
      .replace(
        /-+/g,
        "-"
      )
      .replace(
        /^[-_]+|[-_]+$/g,
        ""
      )
      .slice(
        0,
        32
      );


  return (
    topic ||
    `acl-${Date.now()}`
      .slice(
        0,
        32
      )
  );
}


function safeDataObject(
  value: unknown
): Record<string, unknown> {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    return {};
  }


  return (
    value as
      Record<string, unknown>
  );
}


/* =========================================================
   URL SAFETY
========================================================= */

function safeActionUrl(
  value: unknown
) {
  const supplied =
    String(
      value ??
      DEFAULT_ACTION_URL
    ).trim();


  if (
    supplied.startsWith(
      "/Cardiology/"
    )
  ) {
    return supplied;
  }


  try {
    const parsed =
      new URL(
        supplied,
        "https://drmohamedalaa90.github.io"
      );


    if (
      !ALLOWED_NOTIFICATION_HOSTS.has(
        parsed.hostname
      )
    ) {
      return DEFAULT_ACTION_URL;
    }


    if (
      !parsed.pathname.startsWith(
        "/Cardiology/"
      ) &&
      parsed.hostname ===
        "drmohamedalaa90.github.io"
    ) {
      return DEFAULT_ACTION_URL;
    }


    if (
      parsed.hostname ===
        "acl.drmohamedalaa.org" &&
      !parsed.pathname.startsWith(
        "/"
      )
    ) {
      return DEFAULT_ACTION_URL;
    }


    return (
      `${parsed.pathname}` +
      `${parsed.search}` +
      `${parsed.hash}`
    );
  } catch {
    return DEFAULT_ACTION_URL;
  }
}


function endpointHost(
  endpoint: string
) {
  try {
    return new URL(
      endpoint
    ).hostname;
  } catch {
    return "invalid-endpoint";
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
   * Web Push P-256 public key:
   *
   * Byte 0: uncompressed point marker 04
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
    let index =
      0;

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
   PUSH RESPONSE MESSAGE
========================================================= */

async function readPushFailure(
  response: Response
) {
  let responseBody =
    "";


  try {
    responseBody =
      await response.text();
  } catch {
    responseBody =
      "";
  }


  const message =
    responseBody ||
    response.statusText ||
    `Push provider returned HTTP ${response.status}.`;


  return truncateText(
    message,
    700
  );
}


/* =========================================================
   DEACTIVATE EXPIRED SUBSCRIPTION
========================================================= */

async function deactivateSubscription(
  adminClient: ReturnType<
    typeof createClient
  >,
  subscriptionId: string
) {
  const {
    error
  } =
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
        subscriptionId
      );


  if (error) {
    return error.message;
  }


  return null;
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

      let environment:
        Environment;


      try {
        environment =
          readRequiredEnvironment();
      } catch (
        environmentError
      ) {
        return errorResponse(
          environmentError instanceof
            Error
            ? environmentError.message
            : "Required environment variables are missing.",
          500
        );
      }


      const {
        supabaseUrl,
        supabaseAnonKey,
        serviceRoleKey,
        vapidPublicKey,
        vapidPrivateKey,
        vapidSubject
      } =
        environment;


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
        normalizeNotificationType(
          requestBody.type
        );


      const tag =
        normalizeTopic(
          requestBody.tag
        );


      const notificationId =
        crypto.randomUUID();


      /* ===================================================
         LOAD ACTIVE SUBSCRIPTIONS
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
        ) as
          PushSubscriptionRow[];


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
            0,

          deactivated:
            0,

          activeAfterDelivery:
            0,

          failures:
            []
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
         SHARED PAYLOAD
      =================================================== */

      const pushPayload = {
        title,

        body,

        icon:
          cleanText(
            requestBody.icon,
            DEFAULT_ICON,
            500
          ),

        badge:
          cleanText(
            requestBody.badge,
            DEFAULT_ICON,
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
          notificationId,

        requireInteraction:
          Boolean(
            requestBody.requireInteraction
          ),

        url:
          actionUrl,

        data: {
          ...safeDataObject(
            requestBody.data
          ),

          url:
            actionUrl,

          edition,

          type:
            notificationType,

          notification_id:
            notificationId
        }
      };


      /* ===================================================
         SEND PUSH MESSAGES
      =================================================== */

      const results =
        await processInBatches<
          PushSubscriptionRow,
          PushResult
        >(
          subscriptions,
          DELIVERY_BATCH_SIZE,
          async (
            subscription
          ) => {
            const host =
              endpointHost(
                subscription.endpoint
              );


            try {
              if (
                !subscription.endpoint ||
                !subscription.p256dh ||
                !subscription.auth
              ) {
                return {
                  subscriptionId:
                    subscription.id,

                  userId:
                    subscription.user_id,

                  endpointHost:
                    host,

                  success:
                    false,

                  status:
                    0,

                  statusText:
                    "Invalid subscription",

                  deactivated:
                    false,

                  error:
                    "The subscription record is missing its endpoint or encryption keys."
                };
              }


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
                        tag
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
                      encryptedBody,

                    signal:
                      AbortSignal.timeout(
                        DELIVERY_TIMEOUT_MS
                      )
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

                  endpointHost:
                    host,

                  success:
                    true,

                  status:
                    pushResponse.status,

                  statusText:
                    pushResponse.statusText ||
                    "Delivered",

                  deactivated:
                    false
                };
              }


              const failureMessage =
                await readPushFailure(
                  pushResponse
                );


              const shouldDeactivate =
                pushResponse.status ===
                  404 ||
                pushResponse.status ===
                  410;


              let deactivationError:
                string |
                undefined;


              if (
                shouldDeactivate
              ) {
                const updateError =
                  await deactivateSubscription(
                    adminClient,
                    subscription.id
                  );


                if (updateError) {
                  deactivationError =
                    updateError;
                }
              }


              return {
                subscriptionId:
                  subscription.id,

                userId:
                  subscription.user_id,

                endpointHost:
                  host,

                success:
                  false,

                status:
                  pushResponse.status,

                statusText:
                  pushResponse.statusText ||
                  `HTTP ${pushResponse.status}`,

                deactivated:
                  shouldDeactivate &&
                  !deactivationError,

                error:
                  failureMessage,

                deactivationError
              };
            } catch (
              error
            ) {
              const errorMessage =
                error instanceof
                  Error
                  ? error.message
                  : String(
                      error
                    );


              const timedOut =
                error instanceof
                  DOMException &&
                error.name ===
                  "TimeoutError";


              return {
                subscriptionId:
                  subscription.id,

                userId:
                  subscription.user_id,

                endpointHost:
                  host,

                success:
                  false,

                status:
                  0,

                statusText:
                  timedOut
                    ? "Delivery timeout"
                    : "Delivery exception",

                deactivated:
                  false,

                error:
                  timedOut
                    ? `The push provider did not respond within ${
                        DELIVERY_TIMEOUT_MS /
                        1000
                      } seconds.`
                    : truncateText(
                        errorMessage,
                        700
                      )
              };
            }
          }
        );


      /* ===================================================
         DELIVERY SUMMARY
      =================================================== */

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


      const deactivatedResults =
        results.filter(
          (
            result
          ) =>
            result.deactivated
        );


      const activeAfterDelivery =
        subscriptions.length -
        deactivatedResults.length;


      const statusBreakdown =
        results.reduce<
          Record<string, number>
        >(
          (
            breakdown,
            result
          ) => {
            const key =
              result.status > 0
                ? String(
                    result.status
                  )
                : result.statusText;


            breakdown[
              key
            ] =
              (
                breakdown[
                  key
                ] ??
                0
              ) +
              1;


            return breakdown;
          },
