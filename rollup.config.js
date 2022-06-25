import pkg from "./package.json"
import { terser } from "rollup-plugin-terser";

export default {
    input: "src/index.js",
    output: [
        {
            file: pkg.main,
            type: "cjs"
        },
        {
            file: pkg.module,
            type: "esm"
        }
    ],
    plugins: [
        terser()
    ]
}