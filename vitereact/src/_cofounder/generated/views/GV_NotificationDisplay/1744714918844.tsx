import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, remove_notification, AppNotification } from '@/store/main';

// Internal ToastItem component to handle individual toast rendering and dismissal logic
const ToastItem: React.FC<{ notification: AppNotification }> = ({ notification }) => {
    const dispatch = useDispatch();
    const { id, type, message, duration } = notification;

    // Auto-dismiss logic
    useEffect(() => {
        let timer: NodeJS.Timeout | null = null;
        if (duration) {
            timer = setTimeout(() => {
                dispatch(remove_notification(id));
            }, duration);
        }

        // Cleanup function to clear the timer if the component unmounts
        // or the notification is dismissed manually before the timer fires.
        return () => {
            if (timer) {
                clearTimeout(timer);
            }
        };
    }, [id, duration, dispatch]); // Depend on id, duration, and dispatch

    const handle_dismiss = () => {
        dispatch(remove_notification(id));
    };

    // Determine styling based on notification type
    let bg_color = 'bg-blue-100';
    let border_color = 'border-blue-400';
    let text_color = 'text-blue-800';
    let icon_svg: React.ReactNode | null = null; // Placeholder for potential icons

    switch (type) {
        case 'success':
            bg_color = 'bg-green-100';
            border_color = 'border-green-400';
            text_color = 'text-green-800';
            // Example Icon (using SVG path for simplicity, replace with actual icon component if available)
            icon_svg = (
                <svg className="h-5 w-5 mr-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
            );
            break;
        case 'error':
            bg_color = 'bg-red-100';
            border_color = 'border-red-400';
            text_color = 'text-red-800';
            icon_svg = (
                 <svg className="h-5 w-5 mr-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                 </svg>
            );
            break;
        case 'warning':
            bg_color = 'bg-yellow-100';
            border_color = 'border-yellow-400';
            text_color = 'text-yellow-800';
             icon_svg = (
                 <svg className="h-5 w-5 mr-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 3.001-1.742 3.001H4.42c-1.53 0-2.493-1.667-1.743-3.001l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                 </svg>
            );
            break;
        case 'info':
            bg_color = 'bg-blue-100';
            border_color = 'border-blue-400';
            text_color = 'text-blue-800';
             icon_svg = (
                 <svg className="h-5 w-5 mr-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                 </svg>
            );
            break;
    }

    return (
        <div
            role="alert"
            className={`w-full max-w-sm p-4 rounded-md shadow-lg flex items-start border ${bg_color} ${border_color}`}
        >
            {icon_svg}
            <div className={`flex-grow ${text_color}`}>
                <p className="text-sm font-medium">{message}</p>
            </div>
            <button
                onClick={handle_dismiss}
                type="button"
                className={`ml-auto pl-3 -mr-1 -my-1 ${text_color} opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-${bg_color.split('-')[1]}-100 focus:ring-${bg_color.split('-')[1]}-500 rounded-md p-1`}
                aria-label="Dismiss"
            >
                <span className="sr-only">Dismiss</span>
                {/* Simple 'x' icon */}
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
};


// Main GV_NotificationDisplay component
const GV_NotificationDisplay: React.FC = () => {
    // Select the list of notifications from the global state
    const visible_notifications = useSelector((state: RootState) => state.notifications.app_notifications);

    return (
        <>
            {/* Container for all toast notifications */}
            <div className="fixed top-4 right-4 z-50 space-y-3 w-full max-w-sm">
                {visible_notifications.map((notification) => (
                    <ToastItem key={notification.id} notification={notification} />
                ))}
            </div>
        </>
    );
};

export default GV_NotificationDisplay;