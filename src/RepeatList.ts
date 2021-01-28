import { settings } from './settings-manager';
import {Hanja} from './types';
import { app } from './app';

class RepeatList extends Array<Hanja> {
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

  load() {
    this.reset();
    if (localStorage.getItem('repeatList')) {
      super.push(...JSON.parse(localStorage.getItem('repeatList')!.toString()));
    }
  }

  save() {
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
      app.requestUpdate()
    } catch (e)
  }
}


export let repeatList = new RepeatList;