import data from './data.json';

export declare type Hanja = typeof data[number];

export type HanjaMetadatas = {
  e?: string; // english
  p: { // pinyins
    t: string; // text
    a?: string; // audio
    k?: string; // korean
  }[],
  s: string; // simplified
  ts: string[]; // traditionals
  v?: string[]; // variants
}