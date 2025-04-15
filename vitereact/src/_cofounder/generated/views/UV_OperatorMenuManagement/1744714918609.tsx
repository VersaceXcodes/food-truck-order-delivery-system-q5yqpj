import React, { useState, useEffect, useCallback, ChangeEvent, FormEvent } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch, add_notification, api_client } from '@/store/main';
import { FaPlus, FaEdit, FaTrash, FaSpinner, FaToggleOn, FaToggleOff, FaImage, FaTimes } from 'react-icons/fa';

// --- Types specific to this component ---

interface ModifierOption {
    option_uid: string;
    option_name: string;
    price_adjustment: number;
}

interface ModifierGroup {
    group_uid: string;
    group_name: string;
    selection_type: 'single' | 'multiple';
    is_required: boolean;
    options: ModifierOption[];
}

interface MenuItem {
    item_uid: string;
    item_name: string;
    description: string | null;
    base_price: number;
    photo_url: string | null;
    is_available: boolean;
    display_order: number;
    modifier_groups: ModifierGroup[];
}

interface MenuCategory {
    category_uid: string;
    category_name: string;
    display_order: number;
    is_available: boolean;
    items: MenuItem[];
}

type FullMenuStructure = MenuCategory[];

interface EditModalState {
    is_open: boolean;
    mode: 'add' | 'edit';
    entity_type: 'category' | 'item' | 'group' | 'option';
    entity_uid: string | null;
    parent_uid: string | null; // category_uid for item, item_uid for group, group_uid for option
    form_data: any; // Flexible structure based on entity_type
    form_errors: Record<string, string>;
    form_status: 'idle' | 'loading' | 'error';
}

interface DeleteConfirmationState {
    is_open: boolean;
    entity_type: 'category' | 'item' | 'group' | 'option';
    entity_uid: string | null;
    entity_name: string | null;
    status: 'idle' | 'loading' | 'error';
}

// --- Initial State Definitions ---

const initial_edit_modal_state: EditModalState = {
    is_open: false,
    mode: 'add',
    entity_type: 'category',
    entity_uid: null,
    parent_uid: null,
    form_data: {},
    form_errors: {},
    form_status: 'idle',
};

const initial_delete_confirmation_state: DeleteConfirmationState = {
    is_open: false,
    entity_type: 'category',
    entity_uid: null,
    entity_name: null,
    status: 'idle',
};

// --- Default Form Data Structures ---
const default_category_form = { category_name: '' };
const default_item_form = { item_name: '', description: '', base_price: '', photo: null, modifier_groups: [] }; // photo is File object
const default_group_form = { group_name: '', selection_type: 'single', is_required: false, options: [] };
const default_option_form = { option_name: '', price_adjustment: '' };


// --- Component ---

const UV_OperatorMenuManagement: React.FC = () => {
    const dispatch: AppDispatch = useDispatch();
    const { auth_token } = useSelector((state: RootState) => state.auth);

    const [full_menu_structure, set_full_menu_structure] = useState<FullMenuStructure>([]);
    const [is_loading, set_is_loading] = useState<boolean>(true);
    const [error_message, set_error_message] = useState<string | null>(null);
    const [edit_modal_state, set_edit_modal_state] = useState<EditModalState>(initial_edit_modal_state);
    const [availability_update_status, set_availability_update_status] = useState<Record<string, 'idle' | 'loading' | 'error'>>({});
    const [delete_confirmation_state, set_delete_confirmation_state] = useState<DeleteConfirmationState>(initial_delete_confirmation_state);

    // --- Action: Fetch Menu ---
    const fetch_menu = useCallback(async () => {
        set_is_loading(true);
        set_error_message(null);
        try {
            const response = await api_client.get<FullMenuStructure>('/operators/me/menu', {
                headers: { Authorization: `Bearer ${auth_token}` },
            });
            set_full_menu_structure(response.data);
        } catch (error: any) {
            console.error('Error fetching menu:', error);
            const message = error.response?.data?.error || error.message || 'Failed to fetch menu.';
            set_error_message(message);
            dispatch(add_notification({ type: 'error', message }));
        } finally {
            set_is_loading(false);
        }
    }, [auth_token, dispatch]);

    useEffect(() => {
        fetch_menu();
    }, [fetch_menu]);

    // --- Action: Open/Close Modals ---
    const open_add_edit_modal = (
        mode: 'add' | 'edit',
        entity_type: EditModalState['entity_type'],
        entity_uid: string | null = null,
        parent_uid: string | null = null
    ) => {
        let initial_form_data = {};
        if (mode === 'edit' && entity_uid) {
            // Find the entity in the structure to pre-fill data
            if (entity_type === 'category') {
                const category = full_menu_structure.find(c => c.category_uid === entity_uid);
                initial_form_data = category ? { category_name: category.category_name } : default_category_form;
            } else if (entity_type === 'item') {
                let item = null;
                full_menu_structure.forEach(c => {
                    const found = c.items.find(i => i.item_uid === entity_uid);
                    if (found) item = found;
                });
                initial_form_data = item ? { ...default_item_form, ...item, base_price: item.base_price.toString(), photo: null } : default_item_form;
            } else if (entity_type === 'group') {
                 let group = null;
                 full_menu_structure.forEach(c => c.items.forEach(i => {
                     const found = i.modifier_groups.find(g => g.group_uid === entity_uid);
                     if (found) { group = found; parent_uid = i.item_uid; } // Ensure parent_uid is set
                 }));
                 initial_form_data = group ? { ...default_group_form, ...group } : default_group_form;
            } else if (entity_type === 'option') {
                 let option = null;
                 full_menu_structure.forEach(c => c.items.forEach(i => i.modifier_groups.forEach(g => {
                     const found = g.options.find(o => o.option_uid === entity_uid);
                     if (found) { option = found; parent_uid = g.group_uid; } // Ensure parent_uid is set
                 })));
                 initial_form_data = option ? { ...default_option_form, ...option, price_adjustment: option.price_adjustment.toString() } : default_option_form;
            }
        } else {
            // Set default form data for 'add' mode
            if (entity_type === 'category') initial_form_data = default_category_form;
            else if (entity_type === 'item') initial_form_data = default_item_form;
            else if (entity_type === 'group') initial_form_data = default_group_form;
            else if (entity_type === 'option') initial_form_data = default_option_form;
        }

        set_edit_modal_state({
            is_open: true,
            mode,
            entity_type,
            entity_uid,
            parent_uid,
            form_data: initial_form_data,
            form_errors: {},
            form_status: 'idle',
        });
    };

    const close_add_edit_modal = () => {
        set_edit_modal_state(initial_edit_modal_state);
    };

    const open_delete_confirmation = (
        entity_type: DeleteConfirmationState['entity_type'],
        entity_uid: string,
        entity_name: string
    ) => {
        set_delete_confirmation_state({
            is_open: true,
            entity_type,
            entity_uid,
            entity_name,
            status: 'idle',
        });
    };

    const close_delete_confirmation = () => {
        set_delete_confirmation_state(initial_delete_confirmation_state);
    };

    // --- Action: Handle Input Changes in Modal ---
    const handle_modal_input_change = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;

        if (type === 'checkbox' && e.target instanceof HTMLInputElement) {
             set_edit_modal_state(prev => ({
                ...prev,
                form_data: { ...prev.form_data, [name]: (e.target as HTMLInputElement).checked },
            }));
        } else if (type === 'file' && e.target instanceof HTMLInputElement) {
            set_edit_modal_state(prev => ({
                ...prev,
                form_data: { ...prev.form_data, [name]: (e.target as HTMLInputElement).files?.[0] || null },
            }));
        }
         else {
             set_edit_modal_state(prev => ({
                ...prev,
                form_data: { ...prev.form_data, [name]: value },
            }));
        }
    };

    // --- Action: Handle Modifier Group/Option Changes within Item Form ---
    const handle_modifier_group_change = (group_index: number, field: keyof ModifierGroup, value: any) => {
        set_edit_modal_state(prev => {
            const updated_groups = [...prev.form_data.modifier_groups];
            updated_groups[group_index] = { ...updated_groups[group_index], [field]: value };
            return { ...prev, form_data: { ...prev.form_data, modifier_groups: updated_groups } };
        });
    };

    const add_modifier_group_to_item_form = () => {
         set_edit_modal_state(prev => ({
            ...prev,
            form_data: {
                ...prev.form_data,
                modifier_groups: [...(prev.form_data.modifier_groups || []), { ...default_group_form, temp_id: `new_group_${Date.now()}` }] // Add temp ID for key
            }
        }));
    };

     const remove_modifier_group_from_item_form = (group_index: number) => {
         set_edit_modal_state(prev => ({
            ...prev,
            form_data: {
                ...prev.form_data,
                modifier_groups: prev.form_data.modifier_groups.filter((_, index) => index !== group_index)
            }
        }));
    };

    const handle_modifier_option_change = (group_index: number, option_index: number, field: keyof ModifierOption, value: any) => {
         set_edit_modal_state(prev => {
            const updated_groups = [...prev.form_data.modifier_groups];
            const updated_options = [...updated_groups[group_index].options];
            updated_options[option_index] = { ...updated_options[option_index], [field]: value };
            updated_groups[group_index] = { ...updated_groups[group_index], options: updated_options };
            return { ...prev, form_data: { ...prev.form_data, modifier_groups: updated_groups } };
        });
    };

     const add_modifier_option_to_group_form = (group_index: number) => {
         set_edit_modal_state(prev => {
            const updated_groups = [...prev.form_data.modifier_groups];
             updated_groups[group_index] = {
                ...updated_groups[group_index],
                options: [...(updated_groups[group_index].options || []), { ...default_option_form, temp_id: `new_option_${Date.now()}` }] // Add temp ID for key
            };
            return { ...prev, form_data: { ...prev.form_data, modifier_groups: updated_groups } };
        });
    };

     const remove_modifier_option_from_group_form = (group_index: number, option_index: number) => {
         set_edit_modal_state(prev => {
            const updated_groups = [...prev.form_data.modifier_groups];
            updated_groups[group_index] = {
                ...updated_groups[group_index],
                options: updated_groups[group_index].options.filter((_, index) => index !== option_index)
            };
             return { ...prev, form_data: { ...prev.form_data, modifier_groups: updated_groups } };
        });
    };


    // --- Action: Save Menu Entity ---
    const save_menu_entity = async (e: FormEvent) => {
        e.preventDefault();
        set_edit_modal_state(prev => ({ ...prev, form_status: 'loading', form_errors: {} }));
        set_error_message(null);

        const { mode, entity_type, entity_uid, parent_uid, form_data } = edit_modal_state;

        let url = '/operators/me/menu/';
        const method = mode === 'add' ? 'post' : 'put';
        let payload: any = form_data;
        let is_form_data = false;

        try {
            // --- Determine Endpoint & Payload ---
            if (entity_type === 'category') {
                url += 'categories';
                if (mode === 'edit') url += `/${entity_uid}`;
                payload = { name: form_data.category_name };
                 if (!payload.name) throw new Error("Category name cannot be empty.");
            } else if (entity_type === 'item') {
                url += 'items';
                if (mode === 'edit') url += `/${entity_uid}`;
                else payload.menu_category_uid = parent_uid; // Add category UID when creating

                // Validate Item fields
                if (!payload.item_name) throw new Error("Item name cannot be empty.");
                const price = parseFloat(payload.base_price);
                if (isNaN(price) || price < 0) throw new Error("Base price must be a non-negative number.");

                // Prepare FormData if photo exists
                if (payload.photo instanceof File) {
                    const fd = new FormData();
                    fd.append('name', payload.item_name);
                    fd.append('description', payload.description || '');
                    fd.append('base_price', price.toFixed(2));
                    if (payload.menu_category_uid) fd.append('menu_category_uid', payload.menu_category_uid);
                    fd.append('photo', payload.photo);
                    // Note: Modifiers need separate calls after item creation/update for simplicity in MVP
                    payload = fd;
                    is_form_data = true;
                } else {
                     payload = {
                        name: payload.item_name,
                        description: payload.description || null,
                        base_price: price.toFixed(2),
                        ...(payload.menu_category_uid && { menu_category_uid: payload.menu_category_uid }),
                    };
                }
                // Modifiers handling: Requires separate API calls after item save/update
                // For MVP, we save basic item info first. Modifiers are added/edited via their own modal triggers.
                // If full inline editing of modifiers within item form is desired, it requires complex state management and potentially batch API calls or a different backend structure.
                // Sticking to the defined API structure: save item basics here.

            } else if (entity_type === 'group') {
                 url += `modifier_groups`;
                 if(mode === 'edit') url += `/${entity_uid}`;
                 else url = `/operators/me/menu/items/${parent_uid}/modifier_groups`; // POST needs item UID

                 payload = { name: form_data.group_name, selection_type: form_data.selection_type, is_required: !!form_data.is_required };
                 if (!payload.name || !payload.selection_type) throw new Error("Group name and selection type are required.");
                 // Options saving needs separate calls

            } else if (entity_type === 'option') {
                 url += `modifier_options`;
                 if(mode === 'edit') url += `/${entity_uid}`;
                 else url = `/operators/me/menu/modifier_groups/${parent_uid}/options`; // POST needs group UID

                 const price_adj = parseFloat(form_data.price_adjustment);
                 if (isNaN(price_adj)) throw new Error("Price adjustment must be a number.");
                 payload = { name: form_data.option_name, price_adjustment: price_adj.toFixed(2) };
                 if (!payload.name) throw new Error("Option name is required.");
            }

            // --- Make API Call ---
            const response = await api_client[method](url, payload, {
                headers: {
                    Authorization: `Bearer ${auth_token}`,
                    ...(is_form_data && { 'Content-Type': 'multipart/form-data' }),
                },
            });

            // --- Handle Success ---
            dispatch(add_notification({ type: 'success', message: `${entity_type.charAt(0).toUpperCase() + entity_type.slice(1)} saved successfully.` }));
            close_add_edit_modal();
            await fetch_menu(); // Refresh the menu list

        } catch (error: any) {
            // --- Handle Error ---
            console.error(`Error saving ${entity_type}:`, error);
            const message = error.response?.data?.error || error.message || `Failed to save ${entity_type}.`;
            set_edit_modal_state(prev => ({ ...prev, form_status: 'error', form_errors: error.response?.data?.errors || { general: message } }));
            set_error_message(message); // Also show general error
            dispatch(add_notification({ type: 'error', message }));
        } finally {
            // Ensure loading state is reset even if error handling missed something
             if (edit_modal_state.form_status === 'loading') {
                set_edit_modal_state(prev => ({ ...prev, form_status: 'idle' }));
            }
        }
    };


     // --- Action: Toggle Availability ---
    const toggle_availability = async (entity_uid: string, entity_type: 'category' | 'item', current_availability: boolean) => {
        set_availability_update_status(prev => ({ ...prev, [entity_uid]: 'loading' }));
        set_error_message(null);
        const new_availability = !current_availability;
        const url = `/operators/me/menu/${entity_type === 'category' ? 'categories' : 'items'}/${entity_uid}`;

        try {
            await api_client.put(url, { is_available: new_availability }, {
                headers: { Authorization: `Bearer ${auth_token}` },
            });

            // Optimistic update or refetch
            set_full_menu_structure(prev_structure =>
                prev_structure.map(category => {
                    if (entity_type === 'category' && category.category_uid === entity_uid) {
                        return { ...category, is_available: new_availability };
                    }
                    return {
                        ...category,
                        items: category.items.map(item =>
                            (entity_type === 'item' && item.item_uid === entity_uid)
                                ? { ...item, is_available: new_availability }
                                : item
                        ),
                    };
                })
            );
            set_availability_update_status(prev => ({ ...prev, [entity_uid]: 'idle' }));
            dispatch(add_notification({ type: 'success', message: `${entity_type.charAt(0).toUpperCase() + entity_type.slice(1)} availability updated.` }));

        } catch (error: any) {
            console.error(`Error toggling ${entity_type} availability:`, error);
            const message = error.response?.data?.error || error.message || `Failed to update ${entity_type} availability.`;
            set_availability_update_status(prev => ({ ...prev, [entity_uid]: 'error' }));
            set_error_message(message);
            dispatch(add_notification({ type: 'error', message }));
             // Revert optimistic update on error? For simplicity, we rely on user seeing error and maybe manual refresh/retry.
        } finally {
             // Ensure loading state is reset
             if (availability_update_status[entity_uid] === 'loading') {
                 set_availability_update_status(prev => ({ ...prev, [entity_uid]: 'idle' }));
            }
        }
    };


    // --- Action: Execute Delete ---
    const execute_delete_menu_entity = async () => {
        const { entity_type, entity_uid } = delete_confirmation_state;
        if (!entity_uid) return;

        set_delete_confirmation_state(prev => ({ ...prev, status: 'loading' }));
        set_error_message(null);

        let url = '/operators/me/menu/';
        if (entity_type === 'category') url += `categories/${entity_uid}`;
        else if (entity_type === 'item') url += `items/${entity_uid}`;
        else if (entity_type === 'group') url += `modifier_groups/${entity_uid}`;
        else if (entity_type === 'option') url += `modifier_options/${entity_uid}`;
        else {
             set_delete_confirmation_state(prev => ({ ...prev, status: 'error' }));
             set_error_message("Invalid entity type for deletion.");
             return;
        }

        try {
            await api_client.delete(url, {
                headers: { Authorization: `Bearer ${auth_token}` },
            });
            dispatch(add_notification({ type: 'success', message: `${entity_type.charAt(0).toUpperCase() + entity_type.slice(1)} deleted successfully.` }));
            close_delete_confirmation();
            await fetch_menu(); // Refresh the menu

        } catch (error: any) {
            console.error(`Error deleting ${entity_type}:`, error);
            const message = error.response?.data?.error || error.message || `Failed to delete ${entity_type}.`;
            set_delete_confirmation_state(prev => ({ ...prev, status: 'error' }));
            set_error_message(message);
            dispatch(add_notification({ type: 'error', message }));
        } finally {
             if (delete_confirmation_state.status === 'loading') {
                 set_delete_confirmation_state(prev => ({ ...prev, status: 'idle' }));
            }
        }
    };


    // --- Render ---
    return (
        <>
            <div className="container mx-auto p-4 md:p-6 lg:p-8">
                <h1 className="text-2xl md:text-3xl font-bold mb-6 text-gray-800">Menu Management</h1>

                {is_loading && (
                    <div className="flex justify-center items-center py-10">
                        <FaSpinner className="animate-spin text-4xl text-blue-500" />
                        <span className="ml-3 text-gray-600">Loading Menu...</span>
                    </div>
                )}

                {error_message && !is_loading && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
                        <strong className="font-bold">Error: </strong>
                        <span className="block sm:inline">{error_message}</span>
                        <button onClick={() => set_error_message(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3">
                            <FaTimes />
                        </button>
                    </div>
                )}

                {!is_loading && !error_message && (
                    <div className="space-y-6">
                        {/* --- Add Category Button --- */}
                        <div className="text-right mb-4">
                            <button
                                onClick={() => open_add_edit_modal('add', 'category')}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded inline-flex items-center transition duration-150 ease-in-out"
                            >
                                <FaPlus className="mr-2" /> Add Category
                            </button>
                        </div>

                        {/* --- Menu Structure Area --- */}
                        {full_menu_structure.length === 0 && (
                             <p className="text-center text-gray-500 py-6">Your menu is empty. Start by adding a category.</p>
                        )}

                        {full_menu_structure.map((category) => (
                            <div key={category.category_uid} className="bg-white shadow-md rounded-lg p-4 border border-gray-200">
                                {/* Category Header */}
                                <div className="flex justify-between items-center mb-3 pb-3 border-b border-gray-200">
                                    <h2 className={`text-xl font-semibold ${!category.is_available ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                        {category.category_name}
                                    </h2>
                                    <div className="flex items-center space-x-2">
                                        {/* Category Availability Toggle */}
                                        <button
                                            onClick={() => toggle_availability(category.category_uid, 'category', category.is_available)}
                                            disabled={availability_update_status[category.category_uid] === 'loading'}
                                            className={`text-2xl ${availability_update_status[category.category_uid] === 'loading' ? 'text-gray-400 cursor-wait' : category.is_available ? 'text-green-500 hover:text-green-600' : 'text-gray-400 hover:text-gray-500'}`}
                                            title={category.is_available ? 'Click to make unavailable' : 'Click to make available'}
                                        >
                                            {availability_update_status[category.category_uid] === 'loading' ? <FaSpinner className="animate-spin" /> : category.is_available ? <FaToggleOn /> : <FaToggleOff />}
                                        </button>
                                        {/* Category Actions */}
                                        <button
                                            onClick={() => open_add_edit_modal('edit', 'category', category.category_uid)}
                                            className="text-blue-500 hover:text-blue-700 p-1" title="Edit Category Name"
                                        >
                                            <FaEdit />
                                        </button>
                                        <button
                                            onClick={() => open_delete_confirmation('category', category.category_uid, category.category_name)}
                                            className="text-red-500 hover:text-red-700 p-1" title="Delete Category"
                                        >
                                            <FaTrash />
                                        </button>
                                    </div>
                                </div>

                                {/* Items within Category */}
                                <div className="space-y-3 pl-4">
                                    {category.items.length === 0 && (
                                         <p className="text-sm text-gray-500 italic">No items in this category yet.</p>
                                    )}
                                    {category.items.map((item) => (
                                        <div key={item.item_uid} className="flex items-start space-x-3 p-3 border border-gray-100 rounded bg-gray-50">
                                            {/* Item Image */}
                                             <img
                                                src={item.photo_url || `https://picsum.photos/seed/${item.item_uid}/80/80`}
                                                alt={item.item_name}
                                                className="w-16 h-16 md:w-20 md:h-20 object-cover rounded flex-shrink-0"
                                            />
                                            {/* Item Details */}
                                            <div className="flex-grow">
                                                <div className="flex justify-between items-center mb-1">
                                                    <h3 className={`font-medium ${!item.is_available || !category.is_available ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                                                        {item.item_name}
                                                    </h3>
                                                    <div className="flex items-center space-x-1">
                                                        {/* Item Availability Toggle */}
                                                         <button
                                                            onClick={() => toggle_availability(item.item_uid, 'item', item.is_available)}
                                                            disabled={availability_update_status[item.item_uid] === 'loading'}
                                                            className={`text-xl ${availability_update_status[item.item_uid] === 'loading' ? 'text-gray-400 cursor-wait' : item.is_available ? 'text-green-500 hover:text-green-600' : 'text-gray-400 hover:text-gray-500'}`}
                                                            title={item.is_available ? 'Click to make unavailable' : 'Click to make available'}
                                                        >
                                                            {availability_update_status[item.item_uid] === 'loading' ? <FaSpinner className="animate-spin" /> : item.is_available ? <FaToggleOn /> : <FaToggleOff />}
                                                        </button>
                                                        {/* Item Actions */}
                                                        <button
                                                            onClick={() => open_add_edit_modal('edit', 'item', item.item_uid, category.category_uid)}
                                                            className="text-blue-500 hover:text-blue-700 p-1 text-sm" title="Edit Item"
                                                        >
                                                            <FaEdit />
                                                        </button>
                                                        <button
                                                            onClick={() => open_delete_confirmation('item', item.item_uid, item.item_name)}
                                                            className="text-red-500 hover:text-red-700 p-1 text-sm" title="Delete Item"
                                                        >
                                                            <FaTrash />
                                                        </button>
                                                    </div>
                                                </div>
                                                <p className="text-sm text-gray-600 mb-1">{item.description || <i className="text-gray-400">No description</i>}</p>
                                                <p className="text-sm font-semibold text-gray-700">${item.base_price.toFixed(2)}</p>

                                                {/* Modifier Groups Display (Read-only in main list, edit via item modal) */}
                                                {item.modifier_groups && item.modifier_groups.length > 0 && (
                                                    <div className="mt-2 pl-3 border-l-2 border-gray-200">
                                                        {item.modifier_groups.map(group => (
                                                            <div key={group.group_uid} className="mb-1">
                                                                <p className="text-xs font-medium text-gray-500">
                                                                    {group.group_name} ({group.selection_type}, {group.is_required ? 'Required' : 'Optional'})
                                                                </p>
                                                                <ul className="list-disc list-inside pl-2 text-xs text-gray-500">
                                                                    {group.options.map(option => (
                                                                        <li key={option.option_uid}>
                                                                            {option.option_name} (+${option.price_adjustment.toFixed(2)})
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Add Item Button */}
                                    <div className="pt-2 text-center">
                                         <button
                                            onClick={() => open_add_edit_modal('add', 'item', null, category.category_uid)}
                                            className="text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 font-medium py-1 px-3 rounded inline-flex items-center"
                                        >
                                            <FaPlus className="mr-1" /> Add Item to "{category.category_name}"
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                 {/* --- Add/Edit Modal --- */}
                {edit_modal_state.is_open && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-start z-50 overflow-y-auto p-4 pt-10">
                        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-xl md:max-w-2xl lg:max-w-3xl my-8">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold text-gray-800">
                                    {edit_modal_state.mode === 'add' ? 'Add' : 'Edit'} {edit_modal_state.entity_type.charAt(0).toUpperCase() + edit_modal_state.entity_type.slice(1)}
                                </h2>
                                <button onClick={close_add_edit_modal} className="text-gray-500 hover:text-gray-700 text-2xl">
                                    <FaTimes />
                                </button>
                            </div>

                            <form onSubmit={save_menu_entity}>
                                {edit_modal_state.form_errors.general && (
                                     <p className="text-red-500 text-sm mb-3">{edit_modal_state.form_errors.general}</p>
                                )}

                                {/* --- Category Form --- */}
                                {edit_modal_state.entity_type === 'category' && (
                                    <div className="mb-4">
                                        <label htmlFor="category_name" className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
                                        <input
                                            type="text"
                                            id="category_name"
                                            name="category_name"
                                            value={edit_modal_state.form_data.category_name || ''}
                                            onChange={handle_modal_input_change}
                                            required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        />
                                         {edit_modal_state.form_errors.category_name && <p className="text-red-500 text-xs mt-1">{edit_modal_state.form_errors.category_name}</p>}
                                    </div>
                                )}

                                {/* --- Item Form --- */}
                                {edit_modal_state.entity_type === 'item' && (
                                    <div className="space-y-4">
                                        <div>
                                            <label htmlFor="item_name" className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                                            <input type="text" id="item_name" name="item_name" value={edit_modal_state.form_data.item_name || ''} onChange={handle_modal_input_change} required className="input-field" />
                                            {edit_modal_state.form_errors.item_name && <p className="text-red-500 text-xs mt-1">{edit_modal_state.form_errors.item_name}</p>}
                                        </div>
                                        <div>
                                            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                            <textarea id="description" name="description" value={edit_modal_state.form_data.description || ''} onChange={handle_modal_input_change} rows={3} className="input-field"></textarea>
                                        </div>
                                        <div>
                                            <label htmlFor="base_price" className="block text-sm font-medium text-gray-700 mb-1">Base Price ($)</label>
                                            <input type="number" id="base_price" name="base_price" value={edit_modal_state.form_data.base_price || ''} onChange={handle_modal_input_change} required min="0" step="0.01" className="input-field" />
                                             {edit_modal_state.form_errors.base_price && <p className="text-red-500 text-xs mt-1">{edit_modal_state.form_errors.base_price}</p>}
                                        </div>
                                        <div>
                                            <label htmlFor="photo" className="block text-sm font-medium text-gray-700 mb-1">Photo (Optional)</label>
                                            <div className="flex items-center space-x-3">
                                                {edit_modal_state.form_data.photo_url && !edit_modal_state.form_data.photo && (
                                                    <img src={edit_modal_state.form_data.photo_url} alt="Current" className="w-16 h-16 object-cover rounded" />
                                                )}
                                                {(edit_modal_state.form_data.photo instanceof File) && (
                                                    <img src={URL.createObjectURL(edit_modal_state.form_data.photo)} alt="Preview" className="w-16 h-16 object-cover rounded" />
                                                )}
                                                <input type="file" id="photo" name="photo" onChange={handle_modal_input_change} accept="image/jpeg,image/png,image/gif" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                                            </div>
                                            {edit_modal_state.form_errors.photo && <p className="text-red-500 text-xs mt-1">{edit_modal_state.form_errors.photo}</p>}
                                        </div>

                                        {/* Modifier Groups Section (Inline editing within Item Modal) */}
                                        <div className="border-t pt-4 mt-4">
                                             <h3 className="text-lg font-medium text-gray-700 mb-2">Customization Options</h3>
                                              {(edit_modal_state.form_data.modifier_groups || []).map((group: any, group_index: number) => (
                                                <div key={group.group_uid || group.temp_id} className="border p-3 rounded mb-3 bg-gray-50">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <input
                                                            type="text"
                                                            placeholder="Group Name (e.g., Size, Add-ons)"
                                                            value={group.group_name || ''}
                                                            onChange={(e) => handle_modifier_group_change(group_index, 'group_name', e.target.value)}
                                                            required
                                                            className="input-field text-sm font-semibold flex-grow mr-2"
                                                        />
                                                        <button type="button" onClick={() => remove_modifier_group_from_item_form(group_index)} className="text-red-500 hover:text-red-700 text-sm p-1"><FaTrash /></button>
                                                    </div>
                                                    <div className="flex items-center space-x-4 mb-2 text-sm">
                                                        <label className="flex items-center">
                                                            <input type="radio" name={`selection_type_${group_index}`} value="single" checked={group.selection_type === 'single'} onChange={(e) => handle_modifier_group_change(group_index, 'selection_type', e.target.value)} className="mr-1"/> Single Choice
                                                        </label>
                                                        <label className="flex items-center">
                                                            <input type="radio" name={`selection_type_${group_index}`} value="multiple" checked={group.selection_type === 'multiple'} onChange={(e) => handle_modifier_group_change(group_index, 'selection_type', e.target.value)} className="mr-1"/> Multiple Choice
                                                        </label>
                                                        <label className="flex items-center">
                                                            <input type="checkbox" name={`is_required_${group_index}`} checked={!!group.is_required} onChange={(e) => handle_modifier_group_change(group_index, 'is_required', e.target.checked)} className="mr-1"/> Required
                                                        </label>
                                                    </div>

                                                     {/* Options within Group */}
                                                    <div className="pl-4 space-y-1">
                                                        {(group.options || []).map((option: any, option_index: number) => (
                                                            <div key={option.option_uid || option.temp_id} className="flex items-center space-x-2">
                                                                <input type="text" placeholder="Option Name (e.g., Large)" value={option.option_name || ''} onChange={(e) => handle_modifier_option_change(group_index, option_index, 'option_name', e.target.value)} required className="input-field input-field-sm flex-grow"/>
                                                                <input type="number" placeholder="Price Adj (+$.$$)" value={option.price_adjustment || ''} onChange={(e) => handle_modifier_option_change(group_index, option_index, 'price_adjustment', e.target.value)} required min="0" step="0.01" className="input-field input-field-sm w-28"/>
                                                                 <button type="button" onClick={() => remove_modifier_option_from_group_form(group_index, option_index)} className="text-red-500 hover:text-red-700 text-xs p-1"><FaTrash /></button>
                                                            </div>
                                                        ))}
                                                        <button type="button" onClick={() => add_modifier_option_to_group_form(group_index)} className="text-xs text-blue-600 hover:text-blue-800 mt-1">+ Add Option</button>
                                                    </div>
                                                </div>
                                              ))}
                                               <button type="button" onClick={add_modifier_group_to_item_form} className="text-sm bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-medium py-1 px-3 rounded inline-flex items-center">
                                                    <FaPlus className="mr-1" /> Add Option Group
                                                </button>
                                        </div>
                                    </div>
                                )}

                                {/* --- Group Form (Standalone - Less common, usually within Item) --- */}
                                {edit_modal_state.entity_type === 'group' && (
                                   <div className="space-y-4">
                                        <div>
                                            <label htmlFor="group_name" className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
                                            <input type="text" id="group_name" name="group_name" value={edit_modal_state.form_data.group_name || ''} onChange={handle_modal_input_change} required className="input-field" />
                                        </div>
                                         <div className="flex items-center space-x-4 mb-2 text-sm">
                                            <label className="flex items-center">
                                                <input type="radio" name="selection_type" value="single" checked={edit_modal_state.form_data.selection_type === 'single'} onChange={handle_modal_input_change} className="mr-1"/> Single
                                            </label>
                                            <label className="flex items-center">
                                                <input type="radio" name="selection_type" value="multiple" checked={edit_modal_state.form_data.selection_type === 'multiple'} onChange={handle_modal_input_change} className="mr-1"/> Multiple
                                            </label>
                                        </div>
                                        <label className="flex items-center text-sm">
                                            <input type="checkbox" name="is_required" checked={!!edit_modal_state.form_data.is_required} onChange={handle_modal_input_change} className="mr-1"/> Required Selection
                                        </label>
                                    </div>
                                )}

                                {/* --- Option Form (Standalone - Less common) --- */}
                                {edit_modal_state.entity_type === 'option' && (
                                    <div className="space-y-4">
                                        <div>
                                            <label htmlFor="option_name" className="block text-sm font-medium text-gray-700 mb-1">Option Name</label>
                                            <input type="text" id="option_name" name="option_name" value={edit_modal_state.form_data.option_name || ''} onChange={handle_modal_input_change} required className="input-field" />
                                        </div>
                                        <div>
                                            <label htmlFor="price_adjustment" className="block text-sm font-medium text-gray-700 mb-1">Price Adjustment (+$.$$)</label>
                                            <input type="number" id="price_adjustment" name="price_adjustment" value={edit_modal_state.form_data.price_adjustment || ''} onChange={handle_modal_input_change} required min="0" step="0.01" className="input-field" />
                                        </div>
                                    </div>
                                )}


                                {/* --- Modal Actions --- */}
                                <div className="mt-6 flex justify-end space-x-3">
                                    <button
                                        type="button"
                                        onClick={close_add_edit_modal}
                                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded transition duration-150 ease-in-out"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={edit_modal_state.form_status === 'loading'}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out inline-flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {edit_modal_state.form_status === 'loading' && <FaSpinner className="animate-spin mr-2" />}
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}


                {/* --- Delete Confirmation Modal --- */}
                {delete_confirmation_state.is_open && (
                     <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                             <h2 className="text-lg font-bold text-gray-800 mb-4">Confirm Deletion</h2>
                             <p className="text-gray-600 mb-6">
                                Are you sure you want to delete the {delete_confirmation_state.entity_type}
                                <strong className="mx-1">{delete_confirmation_state.entity_name}</strong>?
                                { (delete_confirmation_state.entity_type === 'category' || delete_confirmation_state.entity_type === 'item' || delete_confirmation_state.entity_type === 'group') &&
                                    <span className="block text-sm text-red-600 mt-1"> This action cannot be undone and will also delete associated items/options.</span>
                                }
                            </p>
                             <div className="flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={close_delete_confirmation}
                                    disabled={delete_confirmation_state.status === 'loading'}
                                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded transition duration-150 ease-in-out disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={execute_delete_menu_entity}
                                    disabled={delete_confirmation_state.status === 'loading'}
                                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out inline-flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {delete_confirmation_state.status === 'loading' && <FaSpinner className="animate-spin mr-2" />}
                                    Confirm Delete
                                </button>
                            </div>
                             {delete_confirmation_state.status === 'error' && error_message && (
                                 <p className="text-red-500 text-sm mt-3">{error_message}</p>
                             )}
                        </div>
                    </div>
                )}

            </div>

            {/* Simple CSS for input fields */}
            <style jsx>{`
                .input-field {
                    display: block;
                    width: 100%;
                    padding: 0.5rem 0.75rem;
                    border: 1px solid #d1d5db; /* gray-300 */
                    border-radius: 0.375rem; /* rounded-md */
                    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); /* shadow-sm */
                    transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
                }
                .input-field:focus {
                    outline: none;
                    border-color: #3b82f6; /* blue-500 */
                    box-shadow: 0 0 0 1px #3b82f6;
                }
                 .input-field-sm {
                     padding: 0.25rem 0.5rem;
                     font-size: 0.875rem; /* text-sm */
                 }
            `}</style>
        </>
    );
};

export default UV_OperatorMenuManagement;