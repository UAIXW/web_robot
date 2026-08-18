import type { KnowledgeDocument } from '../types'

interface Props {
  docs: KnowledgeDocument[]
  onEdit: (doc: KnowledgeDocument) => void
  onDelete: (id: string) => void
  onToggleStatus: (doc: KnowledgeDocument) => void
}

export function DocumentList({ docs, onEdit, onDelete, onToggleStatus }: Props) {
  if (!docs.length) {
    return <div className="empty">暂无文档，点击「新建文档」创建第一篇</div>
  }

  return (
    <div className="doc-list">
      <table>
        <thead>
          <tr>
            <th>标题</th>
            <th>分类</th>
            <th>状态</th>
            <th>更新时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {docs.map((doc) => (
            <tr key={doc.id}>
              <td className="doc-title">{doc.title}</td>
              <td><span className="tag">{doc.category}</span></td>
              <td>
                <button
                  className={`status-badge ${doc.status}`}
                  onClick={() => onToggleStatus(doc)}
                >
                  {doc.status === 'published' ? '已发布' : '草稿'}
                </button>
              </td>
              <td className="doc-date">
                {new Date(doc.updated_at).toLocaleString('zh-CN')}
              </td>
              <td>
                <button className="btn-sm" onClick={() => onEdit(doc)}>编辑</button>
                <button className="btn-sm danger" onClick={() => onDelete(doc.id)}>删除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
