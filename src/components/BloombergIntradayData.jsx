import React, { Component } from "react";
import Chart from "react-apexcharts";
import axios from "axios";


export default class TDMarketData extends Component {
  constructor(props) {
    super(props);
    this.state = {
      series: [
        {
          name: "candle",
          data: []
        }
      ],
      options: {
        chart: {
          type: 'candlestick',
          animations: {
            enabled: true,
            easing: "linear",
            dynamicAnimation: {
              enabled: true,
              speed: 300
            }
          }
        },
        noData: {
          text: 'Loading...'
        },
      },
    };
  }
  
  
  componentDidMount() {
    this.getChartData();
  }
  
  getChartData() {
    const consumerKey = import.meta.env.VITE_TD_CONSUMER_KEY;
    const symbol = 'AAPL';
    const periodType = 'day';
    const period = '1';
    const frequencyType = 'minute';
    const frequency = '15';
    var candle_array = [];
    var i = 0;
    axios.get(`https://api.tdameritrade.com/v1/marketdata/${symbol}/pricehistory?apikey=${consumerKey}` +
    `&periodType=${periodType}&period=${period}&frequencyType=${frequencyType}` +
    `&frequency=${frequency}`)
    .then(res => {
      for (const dataObj of res.data.candles) {
        candle_array[i] = ({
          'x': dataObj.datetime,
          'y': [dataObj.open, dataObj.high, dataObj.low, dataObj.close]
        })
        i += 1;
      }
      this.setState({
        series: [{
          name: 'candlestick',
          data: candle_array,
        }],
      })
    })
    .catch(err => {
      console.log(err);
    });
    
    this.setState({
      series: [{
        name: 'candlestick',
        data: candle_array.x,
        yValueFormatString: "$#,##0.00",
        xValueFormatString: "MMMM",
      }],
      options: {
        chart: {
          type: 'candlestick',
          foreColor: '#ffffff',
          animations: {
            enabled: true,
            easing: "easein",
            speed: 1000,
            animateGradually: {
              enabled: true,
              delay: 10
            },
            dynamicAnimation: {
              enabled: true,
              speed: 1500
            }
          }
        },
        title: {
          text: symbol,
          align: 'center',
          floating: false,
          style: {
            fontSize:  '45px',
            fontWeight:  'bold',
            fontFamily:  undefined,
            color:  '#ffffff'
          },
        },
        tooltip: {
          enabled: false,
        },
        xaxis: {
          type: 'category',
          labels: new Date(candle_array.datetime),
          labels: {
            show: true,
            rotate: -45,
            rotateAlways: false,
            hideOverlappingLabels: true,
            showDuplicates: false,
            trim: false,
            minHeight: undefined,
            maxHeight: 120,
            style: {
              fontSize: '20px',
              fontFamily: 'Helvetica, Arial, sans-serif',
              fontWeight: 400,
            },
            format: undefined,
            formatter: undefined,
            datetimeUTC: true,
            datetimeFormatter: {
              year: 'yyyy',
              month: "MMM 'yy",
              day: 'dd MMM',
              hour: 'HH:mm',
            },
          },
        },
        yaxis: {
          type: 'category',
          labels: {
            show: true,
            rotateAlways: false,
            hideOverlappingLabels: true,
            showDuplicates: false,
            trim: false,
            minHeight: undefined,
            maxHeight: 120,
            style: {
              fontSize: '20px',
              fontFamily: 'Helvetica, Arial, sans-serif',
              fontWeight: 400,
              cssClass: 'apexcharts-xaxis-label',
            },
          },
        },
      }
    });
  }
  
  render() {
    return (
      <div className="app">
        <div className="row">
          <Chart
          options={this.state.options}
          series={this.state.series}
          type="candlestick"
          width="1100"
          height="700"
          />
        </div>
      </div>
      );
    }
  }
