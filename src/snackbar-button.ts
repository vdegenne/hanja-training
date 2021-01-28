import { Button } from "@material/mwc-button";
import { css, customElement } from "lit-element";

@customElement('snackbar-button')
export class SnackbarButton extends Button {
  static styles = [
    Button.styles,
    css`
    .mdc-button__icon {
      margin-right: 0 !important;
    }
    `
  ];
}