import { Dialog } from "@material/mwc-dialog";
import { customElement, html, property } from "lit-element";
import { render } from "lit-html";
import { HanjaMetadatas } from "./types";
import '@material/mwc-button';
import {app} from './app';

@customElement('hanja-metadatas-dialog')
export class HanjaMetadatasDialog extends Dialog {
  @property({type:Object})
  metadatas?: HanjaMetadatas;

  render () {
    if (this.metadatas) {
      this.heading = app.revealed ? this.metadatas.s : 'metadatas';
      render(html`
      ${this.metadatas.p.map((p, i) => {
        return html`${i+1}. ${p.t}`;
      })}
      <mwc-button slot="primaryAction" dialogAction="close">close</mwc-button>
    `, this);
    }
    return super.render();
  }
}