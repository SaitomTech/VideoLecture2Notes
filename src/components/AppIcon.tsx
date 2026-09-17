type AppIconProps = {
  alt?: string
  className?: string
}

const APP_ICON_SRC = '/yomlecta-icon.png'

export function AppIcon({ alt = '', className = '' }: AppIconProps) {
  return <img className={`object-contain ${className}`} src={APP_ICON_SRC} alt={alt} />
}
