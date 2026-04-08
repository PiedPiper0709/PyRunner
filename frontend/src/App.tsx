import React from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { Layout, Menu } from 'antd'
import {
  CodeOutlined,
  PlayCircleOutlined,
  HistoryOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import ScriptLibrary from './pages/ScriptLibrary'
import TaskRunner from './pages/TaskRunner'
import TaskHistory from './pages/TaskHistory'
import './App.css'

const { Header, Content, Footer } = Layout

const App: React.FC = () => {
  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px' }}>
          <div
            style={{
              color: 'white',
              fontSize: 20,
              fontWeight: 'bold',
              marginRight: 48,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <ThunderboltOutlined style={{ fontSize: 24 }} />
            PyRunner
          </div>
          <Menu
            theme="dark"
            mode="horizontal"
            defaultSelectedKeys={['scripts']}
            style={{ flex: 1, minWidth: 0 }}
            items={[
              {
                key: 'scripts',
                icon: <CodeOutlined />,
                label: <Link to="/">Script Library</Link>,
              },
              {
                key: 'runner',
                icon: <PlayCircleOutlined />,
                label: <Link to="/runner">Task Runner</Link>,
              },
              {
                key: 'history',
                icon: <HistoryOutlined />,
                label: <Link to="/history">Task History</Link>,
              },
            ]}
          />
        </Header>

        <Content style={{ padding: '0 50px' }}>
          <div style={{ background: '#fff', padding: 24, minHeight: 380, marginTop: 24 }}>
            <Routes>
              <Route path="/" element={<ScriptLibrary />} />
              <Route path="/runner" element={<TaskRunner />} />
              <Route path="/history" element={<TaskHistory />} />
            </Routes>
          </div>
        </Content>

        <Footer style={{ textAlign: 'center' }}>
          PyRunner ©{new Date().getFullYear()} - Python Script Management Platform
        </Footer>
      </Layout>
    </Router>
  )
}

export default App
