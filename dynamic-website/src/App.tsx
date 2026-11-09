import { useEffect } from 'react'
import { Banner, StatusBar, Toast, TopBar } from './components/Chrome'
import { Intake } from './components/Intake'
import { SourceViewer } from './components/SourceViewer/SourceViewer'
import { Tour } from './components/Tour'
import { useRoute } from './hooks'
import { Card } from './screens/Card/Card'
import { Day } from './screens/Day'
import { Due } from './screens/Due'
import { Audit, Scope, Settings } from './screens/Misc'
import { Patient } from './screens/Patient'
import { Queue } from './screens/Queue'
import { SampleSheet } from './screens/SampleSheet'
import { useStore } from './store/store'

export default function App() {
  const route = useRoute()
  const closeViewer = useStore((s) => s.closeViewer)
  const key = 'id' in route ? route.id : ''
  useEffect(() => closeViewer(), [route.name, key, closeViewer])
  if (route.name === 'sample') return <SampleSheet id={route.id} />
  return (
    <div className="app">
      <Banner />
      <TopBar route={route} />
      <main id="main">
        {route.name === 'day' && <Day />}
        {route.name === 'patient' && <Patient id={route.id} />}
        {route.name === 'card' && <Card id={route.id} />}
        {route.name === 'due' && <Due />}
        {route.name === 'queue' && <Queue />}
        {route.name === 'audit' && <Audit />}
        {route.name === 'settings' && <Settings />}
        {route.name === 'scope' && <Scope />}
      </main>
      <StatusBar />
      <SourceViewer />
      <Intake />
      <Toast />
      <Tour />
    </div>
  )
}
