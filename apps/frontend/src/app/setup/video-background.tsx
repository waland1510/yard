import './video-background.css';

const VIDEO_WIDTH = 1920;
const VIDEO_HEIGHT = 1080;

export const VideoBackground = () => {
  return (
    <div className="video-background">
      <iframe
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        src="https://www.youtube.com/embed/bfSJayt6IpE?autoplay=1&controls=0&mute=1&loop=1&modestbranding=1&showinfo=0&start=2&enablejsapi=1&playlist=bfSJayt6IpE"
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"/>
    </div>
  );
};
