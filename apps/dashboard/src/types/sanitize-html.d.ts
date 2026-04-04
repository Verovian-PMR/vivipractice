declare module "sanitize-html" {
  type SanitizeOptions = Record<string, unknown>;
  function sanitizeHtml(html: string, options?: SanitizeOptions): string;
  export default sanitizeHtml;
}
