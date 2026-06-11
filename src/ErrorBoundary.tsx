import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }
  static getDerivedStateFromError(error: Error): State { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('[ErrorBoundary]', error, info.componentStack) }
  handleReset = () => { this.setState({ error: null }) }
  handleReload = () => { location.reload() }
  render() {
    if (this.state.error) {
      return (
        <div style={{ display:'grid',placeItems:'center',minHeight:'100vh',padding:48,background:'var(--bg)',color:'var(--text)',fontFamily:'Inter,"PingFang SC","Microsoft YaHei",system-ui,sans-serif' }}>
          <div style={{ maxWidth:420,textAlign:'center' }}>
            <div style={{ width:56,height:56,margin:'0 auto 20px',borderRadius:12,background:'#fff0dc',display:'grid',placeItems:'center',fontSize:28 }}>⚠️</div>
            <h2 style={{ margin:'0 0 10px',fontSize:22 }}>出了点问题</h2>
            <p style={{ margin:'0 0 24px',color:'var(--muted)',lineHeight:1.6 }}>页面遇到了一个错误。你的面试数据保存在本地，不会丢失。</p>
            <div style={{ display:'flex',gap:10,justifyContent:'center' }}>
              <button onClick={this.handleReset} style={{ minHeight:40,padding:'0 16px',border:'1px solid var(--line)',borderRadius:9,background:'rgba(255,255,255,.75)',cursor:'pointer',fontFamily:'inherit' }}>重试</button>
              <button onClick={this.handleReload} style={{ minHeight:40,padding:'0 16px',border:'1px solid #111',borderRadius:9,background:'#111',color:'#fff',cursor:'pointer',fontFamily:'inherit' }}>刷新页面</button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
