import { getExtensionVersion, AppName } from '@/utils/utils'
import logo from '@/assets/img/logo.png'

function Header() {
  return (
    <>
      <nav className="glarity--flex glarity--flex-row glarity--justify-between glarity--items-center glarity--mt-5 glarity--px-2">
        <div className="glarity--flex glarity--flex-row glarity--items-center glarity--gap-2">
          <div>
            <img
              src={logo}
              className="glarity--w-10 glarity--h-10 glarity--rounded-lg"
              style={{ 'vertical-align': 'middle' }}
            />
            <span className="font-semibold">
              {AppName} (v
              {getExtensionVersion()})
            </span>{' '}
          </div>
        </div>
        <div className="glarity--flex glarity--flex-row glarity--gap-3">
          <a
            href="https://github.com/sparticleinc/chatgpt-google-summary-extension"
            target="_blank"
            rel="noreferrer"
          >
            Original source
          </a>
        </div>
      </nav>
    </>
  )
}

export default Header
