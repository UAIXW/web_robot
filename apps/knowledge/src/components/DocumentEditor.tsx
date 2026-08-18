import { useState, useEffect } from 'react'
import type { KnowledgeDocument } from '../types'

interface Props {
  doc: KnowledgeDocument | null
  onSave: (doc: Partial<KnowledgeDocument>) => void
  onCancel: () => void
}

export function DocumentEditor({ doc, onSave, onCancel }: Props) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('通用')
  const [status, setStatus] = useState('draft')

  useEffect(() => {
    if (doc) {
      setTitle(doc.title)
      setContent(doc.content)
      setCategory(doc.category)
      setStatus(doc.status)
    } else {
      setTitle('')
      setContent('')
      setCategory('通用')
      setStatus('draft')
    }
  }, [doc])

  const handleSave = () => {
    if (!title.trim()) return
    onSave({
      id: doc?.id,
      title: title.trim(),
      content: content.trim(),
      category: category.trim() || '通用',
      status,
    })
  }

  return (
    <div className="editor-overlay">
      <div className="editor-modal">
        <h2>{doc ? '编辑文档' : '新建文档'}</h2>
        <div className="form-group">
          <label>标题</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="文档标题"
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>分类</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="分类"
            />
          </div>
          <div className="form-group">
            <label>状态</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>内容</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="文档内容..."
            rows={10}
          />
        </div>
        <div className="editor-actions">
          <button className="btn" onClick={onCancel}>取消</button>
          <button className="btn-primary" onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  )
}
