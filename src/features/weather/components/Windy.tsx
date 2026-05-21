import React from "react";

import { readSettings } from '@/lib/settings';
const settings = readSettings();


class Windy extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      link: "",
    }
  }

  setLink(lat, long) {
    const link = `https://embed.windy.com/embed.html?type=map&lat=${String(lat)}&lon=${String(long)}`;
    this.setState({ link });
  }

  componentDidMount() {
    if (settings.latitude) {
      this.setLink(settings.latitude, settings.longitude);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        this.setLink(position.coords.latitude, position.coords.longitude);
      }, () => {
        this.setState({
          link: "https://embed.windy.com/embed.html?type=map",
        });
      });
    } else {
      this.setState({
        link: "https://embed.windy.com/embed.html?type=map",
      });
    }
  }

  render() {
    return (
      <div className={this.props.cardClass || "sticky rounded-xl overflow-hidden h-80"}>
        <iframe
          className="h-full w-full overflow-hidden rounded-[inherit] bg-card"
          width="505"
          height="320"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={this.state.link}
          title="Windy map"
        />
      </div>
    );
  }
}

export default Windy
