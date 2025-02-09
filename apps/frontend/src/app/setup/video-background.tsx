export const VideoBackground = () => {
  return (
      <video
        className="w-full h-[100vh] object-cover"
        autoPlay
        loop
        muted
        playsInline
      >
        <source src="/images/game.mov" type="video/mp4" />
      </video>
  );
};
