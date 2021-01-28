import { css } from 'lit-element';

export default css`
:host {
  display: flex;
  flex-direction: column;
  height: 100vh;
  --mdc-theme-primary: black;
}

[hide] {
  display: none !important;
}
[transparent] {
  opacity: 0 !important;
  transition: none !important;
}

#mainContainer {
  display: flex;
  flex-grow: 1;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

#answer {
  opacity: 1;
  transition: opacity 1s linear;
}

#meaning {
  font-size: 24px;
  margin: 24px 0;
  text-align: center;
  width: 100%;
  overflow: auto;
  white-space: nowrap;
  padding: 0 20px;
  box-sizing: border-box;
}


mwc-snackbar > snackbar-button {
  --mdc-theme-primary: #c7ac5a;
  margin-left: 5px;
}
`

