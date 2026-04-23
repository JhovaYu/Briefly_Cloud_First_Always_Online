import { useState, useEffect } from 'react';
import type { Task, TaskList, TaskState } from '@tuxnotas/shared';
import { TaskService } from '@tuxnotas/shared';
import { Plus, CheckCircle, Circle, Clock, Trash2 } from 'lucide-react';
import * as Y from 'yjs';

interface TaskBoardProps {
    taskList: TaskList;
    service: TaskService;
    doc: Y.Doc; // For real-time updates event listener
}

export function TaskBoard({ taskList, service, doc }: TaskBoardProps) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [newTaskText, setNewTaskText] = useState('');

    useEffect(() => {
        const update = () => {
            setTasks(service.getTasks(taskList.id));
        };
        update();
        doc.on('update', update);
        return () => doc.off('update', update);
    }, [taskList.id, service, doc]);

    const handleAddTask = () => {
        if (!newTaskText.trim()) return;
        service.addTask(taskList.id, newTaskText.trim());
        setNewTaskText('');
    };

    const handleStateChange = (taskId: string, newState: TaskState) => {
        service.updateTask(taskId, { state: newState });
    };

    const handleDelete = (taskId: string) => {
        service.deleteTask(taskId);
    };

    const renderColumn = (title: string, state: TaskState) => {
        const colTasks = tasks.filter(t => t.state === state).sort((a, b) => b.createdAt - a.createdAt);
        return (
            <div className="task-column">
                <div className="task-column-header">
                    <span className={`status-badge status-${state}`}>{title}</span>
                    <span className="count">{colTasks.length}</span>
                </div>
                <div className="task-list">
                    {colTasks.map(task => (
                        <div key={task.id} className="task-card">
                            <div className="task-card-header">
                                <span className="task-text">{task.text}</span>
                                <button className="task-delete-btn" onClick={() => handleDelete(task.id)}><Trash2 size={12} /></button>
                            </div>
                            <div className="task-card-footer">
                                {state !== 'pending' && <button onClick={() => handleStateChange(task.id, 'pending')} title="Mover a pendiente"><Circle size={12} /></button>}
                                {state !== 'working' && <button onClick={() => handleStateChange(task.id, 'working')} title="En progreso"><Clock size={12} /></button>}
                                {state !== 'done' && <button onClick={() => handleStateChange(task.id, 'done')} title="Completar"><CheckCircle size={12} /></button>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="task-board">
            <div className="task-board-header">
                <h2>{taskList.name}</h2>
                <div className="task-input-wrapper">
                    <input
                        value={newTaskText}
                        onChange={(e) => setNewTaskText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                        placeholder="Nueva tarea..."
                    />
                    <button onClick={handleAddTask}><Plus size={16} /></button>
                </div>
            </div>
            <div className="task-columns-container">
                {renderColumn('Pendientes', 'pending')}
                {renderColumn('En Progreso', 'working')}
                {renderColumn('Hechas', 'done')}
            </div>
        </div>
    );
}
