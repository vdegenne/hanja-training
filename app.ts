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

  @query('#settingsDialog') settingsDialog!: Dialog;

  get character () {
    if (!this.hanja) {
      return undefined;
    }
    return this.hanja.s || this.hanja.t;
  }

  static styles = styles;

  render () {
    if (!this.hanja) {
      return nothing
    }

    const c = this.character;

    return html`
    <div style="padding:6px;display:flex;justify-content:space-between;align-items:flex-start;">
      <span ?transparent="${!this.repeatedFeedback}"
        style="background-color:#e0e0e0;color:white;padding:7px;">repeated</span>
      <mwc-icon-button icon="settings"
        @click="${_ => this.settingsDialog.show()}"></mwc-icon-button>
    </div>

    <div id="mainContainer">
      <div id="answer" ?transparent="${this.showHanja === false}">
        <img id="hanjaImg" src="https://hangulhanja.com/api/images/hanmuns/${c}.gif" width="230px"
          ?hide="${this.imgRollback}"
          @click="${this.onImgClick}">
        <div ?hide="${!this.imgRollback}" style="font-size:160px">${c}</div>
      </div>

      <div id="meaning">${this.hanja.m}</div>

      <mwc-button icon="${!this.showHanja ? 'visibility' : 'arrow_forward'}" unelevated @click="${this.onButtonClick}">${this.showHanja ? 'next' : 'show' }</mwc-button>
    </div>

    <div style="height:200px;"></div>


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

    if (this.repeat) {
      this.repeatList.push(this.hanja);
    }

  }

  onImgClick () {
    window.open(`https://hangulhanja.com/hanja/${encodeURIComponent(this.hanja.t)}`, '_blank');
  }

  private getRandomHanja () {
    return data[Math.floor(Math.random() * data.length)]
  }

  clearCache() {
  }
}
