import React, { Component } from "react";
import axios from "axios";
import FilteredImageShader from "./FilteredImageShader";
import {
  getEnabledImageFilterKeys,
} from "@/lib/image-filters";
import { readSettings } from './readSettings';
const settings = readSettings();

class Unsplash extends Component {
  constructor(props) {
    super(props);
    this.state = {
      photos: "",
      category: "",
      loaded: false,
      filterKey: null,
      imageReady: false,
    }
  }

  getRandomCategory() {
    const categoryArray = this.props.search || [];
    if (categoryArray.length === 0) {
      return "landscape";
    }

    const categoryIndex = Math.floor(Math.random() * categoryArray.length);
    return categoryArray[categoryIndex];
  }

  buildFallbackImageUrl(category) {
    const curatedFallbacks = {
      mountains: "https://upload.wikimedia.org/wikipedia/commons/4/4f/Matterhorn_from_Domhütte_-_2.jpg",
      city: "https://upload.wikimedia.org/wikipedia/commons/0/06/Lower_Manhattan_skyline_-_June_2017.jpg",
      bridge: "https://upload.wikimedia.org/wikipedia/commons/0/0c/GoldenGateBridge-001.jpg",
      ocean: "https://upload.wikimedia.org/wikipedia/commons/0/00/Atlantic_near_Faroe_Islands.jpg",
      lake: "https://upload.wikimedia.org/wikipedia/commons/b/bd/Lake_McDonald_in_Glacier_National_Park.jpg",
      architecture: "https://upload.wikimedia.org/wikipedia/commons/a/a6/Paris_Night.jpg",
      aircraft: "https://upload.wikimedia.org/wikipedia/commons/5/56/F-35_Lightning_II.jpg",
      default: "https://upload.wikimedia.org/wikipedia/commons/4/4f/Matterhorn_from_Domhütte_-_2.jpg",
    };

    const normalizedCategory = category.toLowerCase();
    const match = Object.keys(curatedFallbacks).find((key) => normalizedCategory.includes(key));
    return curatedFallbacks[match || "default"];
  }

  async setFallbackPhoto(category) {
    const searchTerm = `${category} filetype:bitmap`;
    const fallbackImage = this.buildFallbackImageUrl(category);

    try {
      const response = await fetch(
        `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
          searchTerm
        )}&gsrnamespace=6&gsrlimit=20&prop=imageinfo&iiprop=url&iiurlwidth=1200&format=json&origin=*`
      );
      const data = await response.json();
      const pages = Object.values(data.query?.pages || {});
      const imageUrls = pages
        .map((page) => page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url)
        .filter(Boolean);

      const photos = imageUrls.length
        ? imageUrls[Math.floor(Math.random() * imageUrls.length)]
        : fallbackImage;

      this.setState({
        photos,
        category,
        loaded: false,
        filterKey: this.pickFilterKey(),
        imageReady: false,
      });
    } catch (_error) {
      this.setState({
        photos: fallbackImage,
        category,
        loaded: false,
        filterKey: this.pickFilterKey(),
        imageReady: false,
      });
    }
  }

  pickFilterKey() {
    const enabledFilterKeys = getEnabledImageFilterKeys(settings.ui?.imageEffects);
    if (enabledFilterKeys.length === 0) {
      return null;
    }

    return enabledFilterKeys[Math.floor(Math.random() * enabledFilterKeys.length)];
  }
  
  componentDidMount() {
    const accessKey = settings.unsplashCredential;
    const category = this.getRandomCategory();

    if (!accessKey) {
      void this.setFallbackPhoto(category);
      return;
    }

    // https://unsplash.com/documentation#get-a-random-photo
    axios.get("https://api.unsplash.com//search/photos?random", {
      params: { 
        query: category,
        per_page: 100,  
      },
      headers: {
        Authorization: "Client-ID " + accessKey,
      },
    }).then(res => {
      var totalFound = res.data.results.length;
      if (!totalFound) {
        this.setFallbackPhoto(category);
        return;
      }

      var randNum = Math.floor(Math.random() * totalFound)
      var full=res.data.results[randNum].urls.raw;
      this.setState({
        photos: full,
        category,
        loaded: false,
        filterKey: this.pickFilterKey(),
        imageReady: false,
      });
    }).catch(err => {
      console.log(err);
      void this.setFallbackPhoto(category);
    });
  }

  render() {
    const filterSettings =
      settings.ui?.imageEffects?.filterSettings?.[this.state.filterKey] || null;
    const shouldUseShader = Boolean(this.state.filterKey && filterSettings && this.state.photos);

    return (
      <div className={this.props.cardClass || "relative rounded-xl overflow-hidden h-full bg-center bg-no-repeat border-0 dark:border-4 dark:border-off-white2"}>
      {!this.state.loaded && (
        <div className="absolute inset-0 flex items-end bg-[linear-gradient(160deg,color-mix(in_oklab,var(--color-accent)_55%,transparent),transparent_45%),linear-gradient(135deg,color-mix(in_oklab,var(--color-card)_96%,black_4%),color-mix(in_oklab,var(--color-secondary)_24%,var(--color-card)))] p-3">
          <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-foreground shadow-sm">
            {this.state.category || "Loading image"}
          </span>
        </div>
      )}
      <img
        className={shouldUseShader ? "hidden" : "min-w-full min-h-full object-cover"}
        src={this.state.photos}
        alt={`Theme tile for ${this.state.category || "landscape"}`}
        onLoad={() => this.setState({ loaded: true, imageReady: true })}
        onError={() => {
          if (!this.state.photos.includes("upload.wikimedia.org")) {
            void this.setFallbackPhoto(this.state.category || this.getRandomCategory());
            return;
          }

          this.setState({ loaded: false, imageReady: false });
        }}
      />
      {shouldUseShader && this.state.imageReady ? (
        <FilteredImageShader
          image={this.state.photos}
          filterKey={this.state.filterKey}
          filterSettings={filterSettings}
          className="pointer-events-none absolute inset-0 z-10 h-full w-full"
        />
      ) : null}
      </div>
    );
  }
}

export default Unsplash;
