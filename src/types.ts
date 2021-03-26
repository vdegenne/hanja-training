import data from './data.json';

export declare type Hanja = typeof data[number];

export type HanjaMetadatas = {
  /** english */
  e?: string;
  /** pinyins */
  p: {
    /** text */
    t: string;
    /** audio */
    a?: string;
    /** korean */
    k?: string;
  }[],
  /* simplified */
  s: string;
  /* traditionals */
  ts: string[];
  /* variants */
  v?: string[];
}