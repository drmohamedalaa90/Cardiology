export const ACL_CONFIG = {
  neonAuthUrl: new URL("/api/neon-auth", window.location.origin).toString(),
  neonDataApiUrl:
    "https://ep-mute-sky-zantnre1.apirest.c-2.eu-west-2.aws.neon.tech/neondb/rest/v1",

  // Media buckets stay read-only on the existing storage service during the
  // database/auth migration because Neon Object Storage is unavailable in
  // this project's region. No authentication or ACL data uses this endpoint.
  mediaStorageUrl:
    "https://zcuseloltsmzohpwmnvo.supabase.co",
  mediaStoragePublishableKey:
    "sb_publishable_YJNKDMu-fbyGMLUT46uUkg_IULOVaZH",

  siteBase: "/",

  vapidPublicKey:
    "BFM-lV_Uf3RvPDVLWZv_bEZgAEW7I-o6KlsJUbUuEDUhOG5QCat0EmD3hRx11WGcyjLmpkYvemP895pMuqPeBjA",

  appName: "ACL; THE EXPERT EDITION",

  modules: [
    {
      id: "ppci",
      title: "Primary PCI Fundamentals",
      href: "modules/ppci/"
    }
  ]
};
