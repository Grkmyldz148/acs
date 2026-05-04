/* PostCSS pipeline.
 *
 * Single plugin: postcss-helmlab. Transforms helmlab() / helmlch() /
 * helmgen() / helmgenlch() colour functions into:
 *   - sRGB rgb() inline (the always-valid baseline)
 *   - color(display-p3 …) wrapped in @supports (P3 displays)
 *   - color(rec2020 …) wrapped in @supports (Rec2020 displays)
 *
 * The @supports cascade means modern CSS minifiers (Lightning CSS,
 * cssnano) preserve the wide-gamut overrides — they don't see them as
 * dead code.
 */
import helmlab from "postcss-helmlab";

export default {
  plugins: [
    helmlab({ outputMode: "all" }),
  ],
};
