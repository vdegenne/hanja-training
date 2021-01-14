import { LitElement, customElement, property, html, css } from "lit-element"; 
import data from './data.json';
import '@material/mwc-button'

@customElement('app-container')
export class AppContainer extends LitElement {
  @property()
  hanja = this.getRandomHanja();

  @property({type: Boolean, reflect: true})
  showHanja = false;

  static styles = css`
  :host {
    height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;

    --mdc-theme-primary: black;
  }

  img {
    opacity: 0;
  }
  :host([showHanja]) img {
    opacity: 1;
    transition: opacity 1s linear;
  }

  #meaning {
    font-size: 24px;
    margin: 24px 0;
    text-align: center;
  }


  `

  get character () {
    return this.hanja.s || this.hanja.t;
  }

  render () {
    const c = this.character;

    return html`
    <img src="https://hangulhanja.com/api/images/hanmuns/${c}.gif" width="230px"
    @click="${this.onImgClick}">
    <div id="meaning">${this.hanja.m}</div>

    <mwc-button icon="${!this.showHanja ? 'visibility' : 'arrow_forward'}" unelevated @click="${this.onButtonClick}">${this.showHanja ? 'next' : 'show' }</mwc-button>
    `;
  }

  onButtonClick () {
    if  (!this.showHanja) {
      this.showHanja = true;
    }
    else {
      this.showHanja = false;
      this.hanja = this.getRandomHanja()
    }
  }

  onImgClick () {
    window.open(`https://hangulhanja.com/hanja/${encodeURIComponent(this.hanja.t)}`, '_blank');
  }

  private getRandomHanja () {
    return data[Math.floor(Math.random() * data.length - 1)]
  }
}