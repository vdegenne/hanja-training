import { settings } from './settings-manager';
import {Hanja} from './types';

export type BagItem = {
  hanja: Hanja;
  score: number;
}

class RepeatList extends Array<BagItem> {
  constructor(...items) {
    super(...items);
    this.load();
  }

  push(...items) {
    const ret = super.push(...items);
    this.updateSettings();
    this.save();
    return ret;
  }

  getLeastCountItems () {
    if (this.length === 0) {
      return [];
    }
    const least = Math.min(...this.map(item => item.score))
    return this.filter(item => item.score === least)
  }

  addItem (hanja: Hanja) {
    this.push({
      hanja, count: 0
    })
  }

  load() {
    this.reset();
    if (localStorage.getItem('repeatList')) {
      super.push(...JSON.parse(localStorage.getItem('repeatList')!.toString()));
    }
  }

  save() {
    // when saving the list we know the structure has changed
    // we should update the different views as well
    window.app.bagDialog.requestUpdate()
    localStorage.setItem('repeatList', JSON.stringify(this));
  }

  reset () {
    this.length = 0;
    this.updateSettings();
    this.updateApp();
  }

  async updateSettings () {
    try {
      settings.requestUpdate();
    } catch (e) {}
  }

  async updateApp () {
    try {
      window.app.requestUpdate()
    } catch (e) {}
  }
}


export let repeatList = new RepeatList;