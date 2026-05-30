import { Card } from 'antd';

export default function HomePage() {
  return (
    <div style={{ display: 'flex', gap: 16, height: '100%' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card style={{ flex: 1, minHeight: 200 }} styles={{ body: { height: '100%' } }}>
          <div style={{ color: '#bfbfbf', textAlign: 'center', paddingTop: 80 }}>区域 1</div>
        </Card>
        <Card style={{ flex: 1, minHeight: 200 }} styles={{ body: { height: '100%' } }}>
          <div style={{ color: '#bfbfbf', textAlign: 'center', paddingTop: 80 }}>区域 2</div>
        </Card>
      </div>
      <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card style={{ flex: 1, minHeight: 200 }} styles={{ body: { height: '100%' } }}>
          <div style={{ color: '#bfbfbf', textAlign: 'center', paddingTop: 80 }}>中央区域 (TBD)</div>
        </Card>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card style={{ flex: 1, minHeight: 200 }} styles={{ body: { height: '100%' } }}>
          <div style={{ color: '#bfbfbf', textAlign: 'center', paddingTop: 80 }}>区域 3</div>
        </Card>
        <Card style={{ flex: 1, minHeight: 200 }} styles={{ body: { height: '100%' } }}>
          <div style={{ color: '#bfbfbf', textAlign: 'center', paddingTop: 80 }}>区域 4</div>
        </Card>
      </div>
    </div>
  );
}
