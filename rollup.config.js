import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve'
import json from '@rollup/plugin-json'
import terser from 'rollup-plugin-terser'

export default {
  input: 'app.ts',
  output: { file: 'bundle.js', format: 'iife'},
  plugins: [resolve(), typescript(), json(), terser]
}