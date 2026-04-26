import React from "react";

class SearchBox extends React.Component {
  constructor(props) {
    super(props);
    this.inputRef = React.createRef();
    this.state = {
      disabled: "1",
    };
  }

  buttonToggle(e) {
    const id = e.target.dataset.engineId;
    if (!id) {
      return;
    }

    this.setState({ disabled: id });
    if (this.inputRef.current) {
      this.inputRef.current.value = "";
    }
  }

  sendSearch(e) {
    if (e.key === "Enter") {
      const buttons = document.querySelectorAll("button[data-address]");

      for (let i = 0; i < buttons.length; i += 1) {
        if (buttons[i].disabled === true) {
          const address = buttons[i].dataset.address;
          const input = encodeURIComponent(e.target.value);
          const url = `${address}${input}`;

          window.open(url);
          e.target.value = "";
          break;
        }
      }
    }
  }

  render() {
    const searchButtonClass =
      "flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card/80 shadow-sm outline-none transition hover:bg-accent/70 disabled:border-primary/40 disabled:bg-primary/14 disabled:opacity-100 opacity-75";

    return (
      <div className="flex justify-center">
        <div>
          <div className="flex space-x-8 justify-center pt-8 pb-4" onClick={this.buttonToggle.bind(this)}>
              <button className={`${searchButtonClass} bg-google-icon bg-center bg-no-repeat bg-[length:1.75rem_1.75rem] cursor-pointer`}
                      type="button" disabled={this.state.disabled === "1"}
                      data-engine-id="1" data-address="http://www.google.com/search?q=">
              </button>
              <button className={`${searchButtonClass} bg-duck-icon bg-center bg-no-repeat bg-[length:1.75rem_1.75rem] cursor-pointer`}
                      type="button" disabled={this.state.disabled === "2"}
                      data-engine-id="2" data-address="https://www.duckduckgo.com/?q="></button>
              <button className={`${searchButtonClass} bg-wolfram-icon bg-center bg-no-repeat bg-[length:1.75rem_1.75rem] cursor-pointer`}
                      type="button" disabled={this.state.disabled === "3"}
                      data-engine-id="3" data-address="https://www.wolframalpha.com/input/?i="></button>
              <button className={`${searchButtonClass} bg-stack-icon bg-center bg-no-repeat bg-[length:1.75rem_1.75rem] cursor-pointer`}
                      type="button" disabled={this.state.disabled === "4"}
                      data-engine-id="4" data-address="https://stackoverflow.com/search?q="></button>
          </div>
          <input
            className="search-input items-center w-60 h-9 border border-input bg-input/45 text-sm text-foreground placeholder:text-muted-foreground rounded-xl shadow-sm transition focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
            autoFocus
            id="search-input"
            type="text"
            ref={this.inputRef}
            onKeyDown={this.sendSearch}
          />
        </div>
      </div>
    );
  }
}

export default SearchBox
