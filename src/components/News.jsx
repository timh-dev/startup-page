import React from "react";


class News extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      posts: [],
      isLoaded: false,
    };
  }

  async fetchData() {
    await fetch(`https://newsapi.org/v2/top-headlines?country=us&category=business&apiKey=${import.meta.env.VITE_NEWS_API_KEY}`)
    .then((response) => response.json())
    .then(data => {this.setState({posts: data.articles})
      console.log(data)
    })
    .catch(err => {
      console.log(err);
    });
  }

  async componentDidMount() {
    this.fetchData()
    this.state.isLoaded = true
  }

	render() {
    console.log(this.state.posts)
    if (this.state.isLoaded) {
      return (
        <>
        <div className="rounded-xl overflow-y-auto overflow-hidden h-80 w-[30.5rem] space-y-0">
            {this.state.posts.map((category) =>(
              <div className="rounded-xl h-24 w-full" key={category.url}>
                  <div className="overflow-hidden h-full w-48 float-left">
                    <img className="w-full max-h-full" src={category.urlToImage} />
                  </div>
                  <div className="pl-4 text-white overflow-hidden h-full w-72 float-left">
                    <a className="text-blue-600 hover:text-blue-800 visited:text-purple-600 pt-1 float-right text-[14px]" href={category.url}>{category.title}</a>
                  </div>
              </div>
            ))}
        </div>
        </>
      );
    }
    else {
      return (
        <>
        <div className="text-center items-center justify-center translate-x-0 translate-y-0">
          <h1>No news.</h1>
        </div>
        </>
      );
    }
  }
}

export default News
