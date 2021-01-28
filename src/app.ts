import { LitElement, customElement, property, html, css, query} from "lit-element"; 
import { nothing } from 'lit-html';
import data from './data.json';
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
import { HanjaMetadatas } from "./types";
import { HanjaMetadatasDialog } from "./hanja-metadatas-dialog";
import './snackbar-button';

declare type Hanja = typeof data[number];

export let app: AppContainer;

@customElement('app-container')
export class AppContainer extends LitElement {
  @property()
  hanja; // = this.getRandomHanja();
  @property({type: Boolean, reflect: true})
  revealed = false;
  @property({ type: Boolean })
  repeat = true;
  @property({ type: Number })
  repeatEvery = 2;
  repeatCount = 0;
  repeatList: Hanja[] = [];
  @property({type:Boolean})
  repeatedFeedback = false;
  @property({type:Boolean})
  imgRollback = false;

  metadatasList = {};
  @property({type:Object})
  metadatas?: HanjaMetadatas;
  @property({type:Boolean})
  audioReady = false;

  
  @query('#settingsDialog') settingsDialog!: Dialog;
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
    
    if (localStorage.getItem('repeatList')) {
      this.repeatList = JSON.parse(localStorage.getItem('repeatList')!.toString());
    }
  }

  render () {
    // if (!this.hanja) {
    //   return nothing
    // }

    const c = this.getCharacter();

    return html`
    <div style="padding:6px;display:flex;justify-content:space-between;align-items:flex-start;">
      <span ?transparent="${!this.repeatedFeedback}"
        style="background-color:#a1887f;color:white;padding:7px;border-radius:4px;">repeated</span>
      <mwc-icon-button icon="settings"
        @click="${_ => this.settingsDialog.show()}"></mwc-icon-button>
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

      <mwc-button icon="${!this.revealed ? 'visibility' : 'arrow_forward'}" raised @click="${this.onButtonClick}">${this.revealed ? 'next' : 'reveal' }</mwc-button>
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


    <mwc-dialog id="settingsDialog" heading="Settings"
      @opened="${() => this.shadowRoot!.querySelector('mwc-slider')!.layout()}"> 
      <div>
        <div class="setting-item">
          <mwc-formfield label="Repeat hanjas">
            <mwc-checkbox ?checked="${this.repeat}"
              @change="${e => this.repeat = e.target.checked}"></mwc-checkbox>
          </mwc-formfield>
          <div class="desc">Repeat hanjas you've already encountered.</div>
        </div>

        <div class="setting-item">
          <mwc-slider step="1" min="1" max="10" markers pin
            ?disabled="${!this.repeat}"
            style="width:100%"
            value="${this.repeatEvery}"
            @input="${e => this.repeatEvery = e.detail.value}"></mwc-slider>          
          <div class="desc">Every ${this.repeatEvery} hanjas.</div>
        </div>
      </div>

      <mwc-button unelevated slot="secondaryAction"
        style="--mdc-theme-primary: #ef5350"
        @click="${this.clearCache}">clear cache</mwc-button>
      <mwc-button slot="primaryAction" dialogAction="close">close</mwc-button>
    </mwc-dialog>

    <hanja-metadatas-dialog .metadatas="${this.metadatas}"></hanja-metadatas-dialog>
    `;
  }

  firstUpdated () {
    // we save the first hanja in the list
    // this.repeatList.push(this.hanja);
    // this.fetchHanjaMetadatas();

    // this.settingsDialog.addEventListener('opened', () => {
    //   this.shadowRoot.querySelector('mwc-slider').layout();
    // })

    // image rollback
    (this.shadowRoot!.querySelector('#hanjaImg') as HTMLImageElement).onerror = () => {
      this.imgRollback = true;
    }

    // buttons icons in snackbar
    this.snackbar.addEventListener('MDCSnackbar:opened', () => {
      this.snackbar.querySelectorAll('mwc-button').forEach(b => {
        b.constructor._styles.push(css`.mdc-button__icon { margin-right: 0 !important; }`);
        // b.shadowRoot.querySelector('.mdc-button__icon').style.marginRight = 0;
      });
    })

    this.newQuestion();
  }

  onButtonClick () {
    if  (!this.revealed) {
      this.revealed = true;
    }
    else {
      this.imgRollback = false;
      this.newQuestion();
    } 
  }

  newQuestion () {
    this.hanja = undefined;
    let hanja: Hanja|undefined;
    const previousHanja = this.hanja;
    this.revealed = false;

    if (this.repeat) {
      this.repeatCount++;
      if (this.repeatCount > this.repeatEvery) {
        this.repeatCount = 0;
        // we grab a word from the list
        // unless the list is empty
        if (this.repeatList.length) {
          do {
            hanja = this.repeatList[Math.floor(Math.random() * this.repeatList.length)]
          } while (this.repeatList.length !== 1 && hanja === previousHanja);
          this.repeatedFeedback = true;
        }
      }
    }

    if (!hanja) {
      do {
        hanja = this.getRandomHanja();
      } while (hanja === previousHanja && this.repeatList.indexOf(hanja) >= 0);
      this.repeatedFeedback = false;
      if (this.repeat) {
        this.repeatList.push(hanja);
        this.saveRepeatList();
      }
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
      const response = await fetch(`https://assiets.vdegenne.com/api/words/chinese/${encodeURIComponent(this.getCharacter(hanja))}`);
      this.metadatasList[character] = await response.json();
    }
    this.metadatas = this.metadatasList[character];

    this.snackbar.labelText = 'loading audios...';
    // setTimeout(() => {
      this.audioReady = true
      this.snackbar.labelText = 'data ready';
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
    this.repeatList = [];
    this.repeatCount = 0;
    this.saveRepeatList();
  }

  saveRepeatList () {
    localStorage.setItem('repeatList', JSON.stringify(this.repeatList));
    console.log(this.repeatList);
  }
}
