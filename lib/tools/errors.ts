/** The PDF has a password or editing restrictions, so its pages can't be copied. (Its own file so image tools don't load pdf-lib.) */
export class LockedPdfError extends Error {
  constructor(name?: string) {
    super(`${name ? `“${name}” is` : "This PDF is"} password-protected or locked against changes. Remove the protection first (open it and save or print it as a new PDF), then try again.`);
    this.name = "LockedPdfError";
  }
}
