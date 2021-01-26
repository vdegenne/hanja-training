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

declare type Hanja = typeof data[number];

@customElement('app-container')
export class AppContainer extends LitElement {
  @property()
  hanja = this.getRandomHanja();
  @property({type: Boolean, reflect: true})
  showHanja = false;
  @property({ type: Boolean })
  repeat = true;
  @property({ type: Number })
  repeatEvery = 2;
  repeatCount = 0;
  repeatList = [];
  @property({type:Boolean})
  repeatedFeedback = false;
  @property({type:Boolean})
  imgRollback = false;

  metadatas = {};
  @property({type:Object})
  metadata;
  @property({type:Boolean})
  audioReady = false;

  @query('#settingsDialog') settingsDialog!: Dialog;
  @query('mwc-snackbar') snackbar!: Snackbar;

  getCharacter (hanja: Hanja = this.hanja) {
    return hanja.s || hanja.t;
  }

  static styles = styles;

  render () {
    if (!this.hanja) {
      return nothing
    }

    const c = this.getCharacter();

    return html`
    <div style="padding:6px;display:flex;justify-content:space-between;align-items:flex-start;">
      <span ?transparent="${!this.repeatedFeedback}"
        style="background-color:#e0e0e0;color:white;padding:7px;border-radius:4px;">repeated</span>
      <mwc-icon-button icon="settings"
        @click="${_ => this.settingsDialog.show()}"></mwc-icon-button>
    </div>

    <div id="mainContainer">
      <div id="answer" ?transparent="${this.showHanja === false}">
        <div ?hide="${this.imgRollback}" style="display:flex;justify-content:center;align-items:center;width:228px;height:228px;overflow:hidden">
          <img id="hanjaImg" src="https://hangulhanja.com/api/images/hanmuns/${c}.gif" width="230px"
            @click="${this.onImgClick}">
        </div>
        <div ?hide="${!this.imgRollback}" style="font-size:160px">${c}</div>
      </div>

      <div id="meaning">${this.hanja.m}</div>

      <mwc-button icon="${!this.showHanja ? 'visibility' : 'arrow_forward'}" unelevated @click="${this.onButtonClick}">${this.showHanja ? 'next' : 'show' }</mwc-button>
    </div>

    <div style="height:200px;"></div>

    <mwc-snackbar> 
      <mwc-button unelevated slot="action" ?disabled="${!this.audioReady}"
        style="--mdc-theme-primary:#616161"
        @click="${e => { e.stopPropagation(); this.playAudio()}}">Play</mwc-button>
    </mwc-snackbar>

    <mwc-dialog id="settingsDialog" heading="Settings">
      <div>
        <div class="setting-item">
          <mwc-formfield label="repeat words">
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
        style="--mdc-theme-primary: red"
        @click="${this.clearCache}">clear cache</mwc-button>
      <mwc-button slot="primaryAction" dialogAction="close">close</mwc-button>
    </mwc-dialog>
    `;
  }

  firstUpdated () {
    // we save the first hanja in the list
    this.repeatList.push(this.hanja);
    this.fetchHanjaMetadatas();

    this.settingsDialog.addEventListener('opened', () => {
      this.shadowRoot.querySelector('mwc-slider').layout();
    })


    // image rollback
    this.shadowRoot.querySelector('#hanjaImg').onerror = () => {
      this.imgRollback = true;
    }
  }

  onButtonClick () {
    if  (!this.showHanja) {
      this.showHanja = true;
    }
    else {
      this.imgRollback = false;
      this.newQuestion();
    } 
  }

  newQuestion () {
    let hanja;
    const previousHanja = this.hanja;
    this.showHanja = false;

    if (this.repeat) {
      this.repeatCount++;
    }
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

    if (!hanja) {
      do {
        hanja = this.getRandomHanja()
      } while (hanja === previousHanja);
      this.repeatedFeedback = false;
    }

    this.hanja = hanja;

    // we start fetching the hanja's metadatas
    this.fetchHanjaMetadatas();

    if (this.repeat) {
      this.repeatList.push(this.hanja);
    }

  }

  async fetchHanjaMetadatas (hanja: Hanja = this.hanja) { 
    this.audioReady = false;
    this.openSnackbar('Loading audio file...', -1);
    const character = this.getCharacter(hanja);
    if (!this.metadatas[character]) {
      const response = await fetch(`https://assiets.vdegenne.com/api/words/chinese/${encodeURIComponent(this.getCharacter(hanja))}`);
      this.metadatas[character] = await response.json();
    }
    this.metadata = this.metadatas[character];

    this.snackbar.labelText = 'Audio ready');
    this.audioReady = true;
  }

  onImgClick () {
    window.open(`https://hangulhanja.com/hanja/${encodeURIComponent(this.hanja.t)}`, '_blank');
  }

  private getRandomHanja () {
    return data[Math.floor(Math.random() * data.length)]
  }

  playAudio () {
    new Audio(this.metadata.p[0].a).play();
  }

  openSnackbar (text, timeoutMs = 5000) {
    this.snackbar.labelText = text;
    this.snackbar.timeoutMs = timeoutMs;
    this.snackbar.show();
  }

  clearCache() {
  }
}
