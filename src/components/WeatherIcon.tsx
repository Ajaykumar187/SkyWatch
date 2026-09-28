import { getWeatherCodeInfo } from "@/lib/weatherCodes";

export default function WeatherIcon({
  code,
  size = 64,
}: {
  code: number;
  size?: number;
}) {
  const info = getWeatherCodeInfo(code);
  return (
    <span
      className={`weather-icon weather-icon-${info.category}`}
      style={{ fontSize: size }}
      role="img"
      aria-label={info.description}
      title={info.description}
    >
      {info.emoji}
    </span>
  );
}
