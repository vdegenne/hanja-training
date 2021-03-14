import { BagItem } from "./RepeatList";

export function getCharacter (bagItem: BagItem) {
  if (!bagItem) {
    return undefined;
  }
  return bagItem.hanja.s || bagItem.hanja.t;
}