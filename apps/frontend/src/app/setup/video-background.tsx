
export const VideoBackground = () => {
  return (
    <div>
      <video
        autoPlay
        loop
        muted
        playsInline
      >
        <source src="/images/game.mov" type="video/mp4" />
      </video>
    </div>
  );
};
