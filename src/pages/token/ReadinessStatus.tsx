import {Typography} from 'antd';
import type {readinessView} from '@/lib/vault/readiness';
export default function ReadinessStatus({view}:{view:ReturnType<typeof readinessView>}){return <><Typography.Text role="status">{view.label}</Typography.Text>{view.details.length>0&&<details><summary>迁移状态说明</summary>{view.details.map((text,i)=><Typography.Paragraph key={i}>{text}</Typography.Paragraph>)}<Typography.Text type="secondary">来源核验属于部署准备；解锁不会消除来源或部署问题。已有数据和迁移进度保留。</Typography.Text></details>}</>;}
