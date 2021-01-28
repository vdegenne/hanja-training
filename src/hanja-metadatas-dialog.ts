import { Dialog } from "@material/mwc-dialog";
import { customElement, html, property } from "lit-element";
import { render } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html";
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
      <div style="margin: 7px 0 15px;">${this.metadatas.e}</div>
      ${this.metadatas.p.map((p, i) => {
        return html`
        <div style="margin:0 0 15px 0;">
          <div>${i+1}. <b>${p.t}</b></div>
          <div style="padding: 5px 10px 0;white-space: break-spaces;">${unsafeHTML(p.k)}</div>
        </div>
        `;
      })}
      <mwc-button slot="primaryAction" dialogAction="close">close</mwc-button>
    `, this);
    }
    return super.render();
  }
}