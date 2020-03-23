# Amplify Video Live Streaming Quickstart

## Create a base application

To get started, create a basic react application using [create-react-app](https://github.com/facebook/create-react-app).

```
npx create-react-app my-live-app
```

## Initialize your Amplify project

Move into the project folder and initialize your project as an Amplify project.

```
cd my-live-app
amplify init
```
Follow the prompts to configure your project. You can learn more about the Amplify CLI and project configuration through the [Amplify Quickstart documentation](https://aws-amplify.github.io/docs/cli-toolchain/quickstart).


## Add a video resource

Add video to your application. Follow the prompts and note that the default values will be sufficient for most users

```
amplify add video
```


With the Video resource configured in our project, simply push the project to deploy the AWS resources that back it.

```
amplify push
```

## Add a player

Add video.js to your project 

```
npm install video.js
```

Open ```App.js``` within your favorite code editor and replace the entire file with the following code. Note that the playback url is stored in `aws-video-exports` by Amplify Video and imported alongside the video.js library to supply the playback information for the player.

```javascript
import React from 'react';
import logo from './logo.svg';
import './App.css';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import awsvideoconfig from './aws-video-exports';

class VideoPlayer extends React.Component {
  componentDidMount() {
    this.player = videojs(this.videoNode, this.props);
  }

  componentWillUnmount() {
    if (this.player) {
      this.player.dispose();
    }
  }

  render() {
    return (
      <div>
        <div data-vjs-player>
          <video ref={(node) => { this.videoNode = node; }} className="video-js" />
        </div>
      </div>
    );
  }
}

const videoJsOptions = {
  autoplay: true,
  controls: true,
  sources: [{
    src: awsvideoconfig.awsOutputLiveLL,
  }]
}

function App() {
  return (
    <div className="App">
      <header className="App-header">
      <VideoPlayer { ...videoJsOptions } />
      </header>
    </div>
  );
}

export default App;
```
## Stream

If you don't have a live encoder already, you'll need one that can produce an RTMP stream to AWS. [Open Broadcast Software (OBS)](https://obsproject.com/) is a popular open source live encoder that can be automatically configured through Amplify video. Download OBS, make sure it's closed, and run the following command to configure an OBS profile to push to your Video resource.

```
amplify video setup-obs
```

Open OBS and click `Profile` in the menu and then select the name of the Video resource that you configured. For example, `myvideoresource`


To stream video, you need to add a Source to OBS. At the bottom of the window is a box called 'Sources'. Click on the + (or right click inside the box) and pick the source you want. Select Video Capture Device for a webcam or capture card.

Click 'Start Streaming' to publish a live stream to the AWS infrastructure backing the Video resource.

Run your react application locally and you should see a live stream published to it

```
npm start
```

## What Next?

Congratulations, you've built a simple react application that serves live video. Try adding other Amplify categories like Auth, API, or Analytics alongside your video stream or deploying your application to AWS for hosting using `amplify console`.

For a more detailed application development guide, check out our [UnicornTrivia Workshop](https://github.com/awslabs/aws-amplify-unicorntrivia-workshop) that will show you how to build interactivity on top of a similar application

