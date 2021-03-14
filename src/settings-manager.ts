import { Dialog } from "@material/mwc-dialog";
import { LitElement, html, property, customElement, query, css, PropertyValues } from "lit-element";
import { nothing } from "lit-html";
import '@material/mwc-icon';
import { repeatList } from "./RepeatList";

export type Settings = {
  repeat: boolean;
  repeatEvery: number;
  repeatLength: number;
  repeatOnly: boolean;
}

@customElement('settings-manager')
class SettingsManager extends LitElement {
  @property({type:Boolean})
  repeat = true;
  @property({type:Number})
  repeatEvery = 2;
  @property({type:Number})
  repeatLength = 1;
  @property({type:Boolean})
  repeatOnly = false;

  @query('#settingsDialog') settingsDialog!: Dialog;

  constructor() {
    super();
    this.load();
  }

  static styles = css`
    .setting-item .desc {
      font-size: 13px;
      padding: 0 20px 0 53px; 
      box-sizing: border-box;
      position: relative;
      top: -7px;
      color: grey;
    }

    mwc-slider {
      width: 100%;
      padding: 0 25px;
      box-sizing: border-box;
    }
  `;

  render() {
    return html`
    <mwc-dialog id="settingsDialog" heading="Settings"
      @opened="${() => this.shadowRoot!.querySelectorAll('mwc-slider').forEach(s => s.layout())}"> 
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
            ?disabled="${!this.repeat || this.repeatOnly}"
            style="width:100%"
            value="${this.repeatEvery}"
            @input="${e => this.repeatEvery = e.detail.value}"></mwc-slider>
          <div class="desc">Every : ${this.repeatEvery} hanjas.</div>
        </div>

        <div class="setting-item">
          <mwc-slider step="1" min="1" max="${repeatList.length < 5 ? 5 : repeatList.length}" markers pin
            ?disabled="${!this.repeat || this.repeatOnly}"
            style="width:100%"
            value="${this.repeatLength}"
            @input="${e => this.repeatLength = e.detail.value}"></mwc-slider>          
          <div class="desc">Length: repeat ${this.repeatLength} hanjas.</div>
        </div>

        <div style="margin:0 20px;">
          <div class="setting-item">
            <mwc-formfield label="Repeat only">
              <mwc-checkbox
                ?checked="${this.repeatOnly}"
                ?disabled="${!this.repeat || repeatList.length < 3}"
                @change="${e => this.repeatOnly = e.target.checked}"
              ></mwc-checkbox>
            </mwc-formfield>
            <div class="desc">New hanjas won't be proposed, only already encountered hanjas.<br>
            ${repeatList.length < 3 ? `Requires at least 3 hanjas in the bag. (${repeatList.length}/3)` : nothing}</div>
          </div>
        </div>
      </div>

      <mwc-button unelevated slot="secondaryAction"
        style="--mdc-theme-primary: #ef5350"
        @click="${this.clearCache}">clear cache</mwc-button>
      <mwc-button slot="primaryAction" dialogAction="close">close</mwc-button>
    </mwc-dialog>
    `
  }

  updated(_changedProperties: PropertyValues) {
    this.save();

    // update to new properties
    for (const prop of _changedProperties) {
      _changedProperties.set(prop[0], this[prop[0]]);
    }

    // when settings are updated we should fire an event
    this.dispatchEvent(new CustomEvent('update', {
      detail: _changedProperties
    }));
  }

  show() {
    this.settingsDialog.show();
  }

  save () {
    const settings: Settings = {
      repeat: this.repeat,
      repeatEvery: this.repeatEvery,
      repeatLength: this.repeatLength,
      repeatOnly: this.repeatOnly,
    }
    localStorage.setItem('settings', JSON.stringify(settings));
    // console.log('settings saved')
  }

  load () {
    if (localStorage.getItem('settings')) {
      const settings: Settings = JSON.parse(localStorage.getItem('settings')!);
      this.repeat = settings.repeat;
      this.repeatEvery = settings.repeatEvery;
      this.repeatLength = settings.repeatLength;
      this.repeatOnly = settings.repeatOnly;

      this.adjustRepeatLength();
    }
  }

  clearCache() {
    window.app.clearCache();
    this.repeatOnly = false;
    this.adjustRepeatLength();
    // this.save();
  }

  adjustRepeatLength () {
    if (this.repeatLength > 5 && this.repeatLength > repeatList.length) {
      this.repeatLength = 5;
      this.save();
    }
  }
}

export const settings = new SettingsManager;