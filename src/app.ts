import { LitElement, customElement, property, html, css, query, PropertyValues} from "lit-element"; 
import { nothing } from "lit-html";
import '@material/mwc-button'
import '@material/mwc-icon-button';
import '@material/mwc-dialog';
import { Dialog } from '@material/mwc-dialog';
import '@material/mwc-formfield';
import '@material/mwc-checkbox';
import styles from './styles';
import '@material/mwc-slider';
import '@material/mwc-snackbar';
import {Snackbar} from '@material/mwc-snackbar';
import '@material/mwc-circular-progress';
import '@material/mwc-icon';
import './hanja-metadatas-dialog';
import { Hanja, HanjaMetadatas } from "./types";
import { HanjaMetadatasDialog } from "./hanja-metadatas-dialog";
import './snackbar-button';
import { settings, Settings } from './settings-manager';
import data from './data.json';
import { repeatList } from "./RepeatList";

export let app: AppContainer;

@customElement('app-container')
export class AppContainer extends LitElement {
  @property()
  hanja; // = this.getRandomHanja();
  @property({type: Boolean, reflect: true})
  revealed = false;

  repeatCount = 0;
  @property()
  repeatedFeedback = '';

  @property({type:Boolean})
  imgRollback = false;

  metadatasList = {};
  @property({type:Object})
  metadatas?: HanjaMetadatas;
  @property({type:Boolean})
  audioReady = false;

  @query('mwc-snackbar') snackbar!: Snackbar;
  @query('hanja-metadatas-dialog') hanjaMetadatasDialog!: HanjaMetadatasDialog;

  getCharacter (hanja: Hanja = this.hanja) {
    if (!hanja) {
      return undefined;
    }
    return hanja.s || hanja.t;
  }

  static styles = styles;

  constructor () {
    super();
    app = this;
  }

  render () {
    // if (!this.hanja) {
    //   return nothing
    // }

    const c = this.getCharacter();

    return html`
    <div style="padding:6px;display:flex;justify-content:space-between;align-items:flex-start;">
      <span ?transparent="${!this.repeatedFeedback}"
        style="background-color:#a1887f;color:white;padding:7px;border-radius:4px;">${this.repeatedFeedback}</span>
      <mwc-icon-button icon="settings"
        @click="${_ => settings.show()}"></mwc-icon-button>
    </div>

    <div id="mainContainer">
      <div id="answer" ?transparent="${this.revealed === false}">
        <div ?hide="${this.imgRollback}" style="display:flex;justify-content:center;align-items:center;width:228px;height:228px;overflow:hidden">
          <img id="hanjaImg" src="${c ? `https://hangulhanja.com/api/images/hanmuns/${c}.gif` : ''}" width="230px"
            @click="${this.onImgClick}">
        </div>
        <div ?hide="${!this.imgRollback}" style="font-size:160px">${c}</div>
      </div>

      <div id="meaning">${this.hanja && this.hanja.m}</div>

      <div>
        ${!this.revealed ? html`<mwc-button icon="visibility" raised @click="${this.reveal}">reveal</mwc-button>` : nothing}
        
        ${this.revealed && settings.repeat && !this.repeatedFeedback ? html`
          <mwc-button icon="done" raised @click="${this.keep}">keep</mwc-button>
          <mwc-button icon="arrow_forward" trailingIcon raised @click="${this.next}">pass</mwc-button>
        ` : nothing}

        ${this.revealed && settings.repeat && this.repeatedFeedback ? html`
          <mwc-button icon="done" outlined @click="${this.iknow}" style="--mdc-theme-primary:#4caf50">i knew</mwc-button>
          <mwc-button icon="clear" outlined @click="${this.idontknow}" style="--mdc-theme-primary:#f44336">i didn't know</mwc-button>
        ` : nothing}

      </div>

      <div style="display:flex;align-items:center;margin: 10px 0 0 0;">
        <mwc-icon>reorder</mwc-icon><span style="margin-left:5px">bag: ${repeatList.length}</span>
      </div>
    </div>

    <div style="height:200px;"></div>

    <mwc-snackbar>
      <snackbar-button unelevated slot="action" ?disabled="${!this.metadatas}"
        icon="${this.metadatas ? 'remove_red_eye': ''}"
        @click="${e => {e.stopPropagation(); this.hanjaMetadatasDialog.show()}}">
        <mwc-circular-progress
          ?hide="${this.metadatas}"
          indeterminate
          style="width:24px;"></mwc-circular-progress>
      </snackbar-button>
      <snackbar-button unelevated slot="action" ?disabled="${!this.audioReady}"
        icon="${this.audioReady ? 'volume_up' : ''}"
        @click="${e => {e.stopPropagation(); this.playAudio()}}">
        <mwc-circular-progress
          ?hide="${this.audioReady}"
          indeterminate
          style="width:24px;"></mwc-circular-progress>
      </snackbar-button>
    </mwc-snackbar>

    ${settings}

    <hanja-metadatas-dialog .metadatas="${this.metadatas}"></hanja-metadatas-dialog>
    `;
  }

  firstUpdated () {
    // image rollback
    (this.shadowRoot!.querySelector('#hanjaImg') as HTMLImageElement).onerror = () => {
      this.imgRollback = true;
    }

    // buttons icons in snackbar
    // this.snackbar.addEventListener('MDCSnackbar:opened', () => {
    //   this.snackbar.querySelectorAll('mwc-button').forEach(b => {
    //     b.constructor._styles.push(css`.mdc-button__icon { margin-right: 0 !important; }`);
    //     // b.shadowRoot.querySelector('.mdc-button__icon').style.marginRight = 0;
    //   });
    // })

    this.newQuestion();


    settings.addEventListener('update', e => {
      const detail: Map<keyof Settings, any> = (e as CustomEvent).detail;
      if (detail.size > 1) {
        return;
      }

      if (
        detail.has('repeatOnly')
        || (detail.has('repeat') && detail.get('repeat') === true && settings.repeatOnly === true && !this.repeatedFeedback)
        || (detail.has('repeat') && detail.get('repeat') === false && this.repeatedFeedback)
      ) {
        this.next();
      }
    })
  }

  reveal() {
    this.revealed = true;
  }

  keep () {
    repeatList.push(this.hanja);
    this.next();
  }

  iknow () {
    this.next();
  }
  idontknow () {
    this.next();
  }

  next () {
    this.imgRollback = false;
    this.newQuestion();
  }

  newQuestion () {
    const previousHanja = this.hanja;
    this.hanja = undefined; // reset the img
    let hanja: Hanja|undefined;
    this.revealed = false;

    if (settings.repeat) {
      if (!settings.repeatOnly) {
        this.repeatCount++;
        if (this.repeatCount > settings.repeatEvery) {
          if (this.repeatCount >= (settings.repeatEvery + (Math.min(settings.repeatLength, repeatList.length)))) {
            this.repeatCount = 0;
          }
          // we grab a word from the list
          // unless the list is empty
          if (repeatList.length) {
            do {
              hanja = repeatList[Math.floor(Math.random() * repeatList.length)]
            } while (repeatList.length !== 1 && hanja === previousHanja);
            this.repeatedFeedback = 'repeated';
          }
        }
      }
      else {
        // repeat mode
        this.repeatedFeedback = 'repeat mode';
        do {
          hanja = repeatList[Math.floor(Math.random() * repeatList.length)]
        } while (hanja === previousHanja);
      }
    }

    if (!hanja) {
      do {
        hanja = this.getRandomHanja();
      } while (hanja === previousHanja && repeatList.indexOf(hanja) >= 0);
      this.repeatedFeedback = '';
      // if (settings.repeat) {
      //   repeatList.push(hanja);
      // }
    }

    this.hanja = hanja;

    // we start fetching the hanja's metadatas
    this.fetchHanjaMetadatas();
  }

  async fetchHanjaMetadatas (hanja: Hanja = this.hanja) { 
    this.metadatas = undefined;
    this.audioReady = false;
    this.openSnackbar('loading details...', -1);
    const character = this.getCharacter(hanja)!;
    if (!this.metadatasList[character]) {
      const response = await fetch(`https://assiets.vdegenne.com/api/words/chinese/${encodeURIComponent(this.getCharacter(hanja)!)}`);
      this.metadatasList[character] = await response.json();
    }
    this.metadatas = this.metadatasList[character];

    this.snackbar.labelText = 'loading audios...';
    // setTimeout(() => {
      this.audioReady = true
      this.snackbar.labelText = 'data ready';
      this.playAudio();
    // }, 2000);
  }

  onImgClick () {
    window.open(`https://hangulhanja.com/hanja/${encodeURIComponent(this.hanja.t)}`, '_blank');
  }

  private getRandomHanja (): Hanja {
    return data[Math.floor(Math.random() * data.length)]
  }

  playAudio () {
    new Audio(this.metadatas!.p[0].a).play();
    this.snackbar.labelText = this.metadatas!.p.map(p => p.t).join(', ');
  }

  openSnackbar (text, timeoutMs = 5000) {
    this.snackbar.labelText = text;
    this.snackbar.timeoutMs = timeoutMs;
    this.snackbar.show();
  }

  clearCache() {
    repeatList.reset();
    repeatList.save();
    this.repeatCount = 0;
  }
}
