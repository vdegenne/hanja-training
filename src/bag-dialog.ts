import { css, customElement, html, LitElement, query } from "lit-element";
import '@material/mwc-dialog'
import '@material/mwc-button'
import '@material/mwc-icon-button'
import { BagItem, repeatList } from "./RepeatList";
import { Dialog } from "@material/mwc-dialog";
import { getCharacter } from "./util";

@customElement('bag-dialog')
export class BagDialog extends LitElement {
  @query('mwc-dialog') dialog!: Dialog;

  static styles = css`
  :host {
    position: relative;
    z-index: 9;
  }
  .items {
    display: flex;
    flex-wrap: wrap;
    width: 320px;
    margin: 0 auto;
  }
  .item {
    display: flex;
    flex-direction: column;
    position: relative;
    background: red;
    margin: 4px;
    box-sizing: border-box;
  }
  .item > mwc-icon-button {
    position: absolute;
    top: 4px;
    right: 4px;
    --mdc-icon-size: 20px;
    --mdc-icon-button-size: 24px;
  }
  .item > .name {
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 52px;
    width: 90px;
    height: 80px;
    padding: 12px 8px 0 0;
    background-color: #eeeeee;
  }
  .item > .score {
    padding: 4px 10px;
    box-sizing: border-box;
    /* text-align: center; */
    background-color: #bdbdbd;
    color: white;
  }
  `

  render () {
    // we should sort the bag from low scores to high ones
    const items = repeatList.sort((i1, i2) => {
      return i1.score - i2.score;
    })

    return html`
    <mwc-dialog heading="Bag (${repeatList.length} items)">
      <p>Items are sorted from low scores to high ones</p>

      <div class="items">
      ${items.map(item => this.itemTemplate(item))}
      </div>

      <mwc-button outlined slot="primaryAction" dialogAction="close">close</mwc-button>
    </mwc-dialog>
    `
  }

  itemTemplate (bagItem: BagItem) {
    return html`
    <div class="item">
      <mwc-icon-button icon="close"></mwc-icon-button>
      <span class="name">${getCharacter(bagItem)}</span>
      <span class="score">score: ${bagItem.score}</span>
    </div>
    `
  }

  open() {
    this.dialog.show()
  }
}