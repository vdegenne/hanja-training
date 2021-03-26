import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve'
import json from '@rollup/plugin-json'
import {terser} from 'rollup-plugin-terser'

export default {
  input: 'src/app.ts',
  output: { file: 'bundle.js', format: 'iife', sourcemap: true },
  plugins: [resolve(), typescript({
    // sourceMap: true
  }), json(), /*terser()*/]
}