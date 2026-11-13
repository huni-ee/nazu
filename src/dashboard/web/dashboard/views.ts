/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { createRoomViews } from '../components/rooms/views.js';
import { createMediaViewer } from '../utils/media-viewer.js';
import { createFriendViews } from '../components/friends/views.js';
import { ui } from './ui.js';

export const roomViews = createRoomViews();
export const { close: closeDialog, showImage: showImageViewer, showVideo: showVideoViewer } = createMediaViewer(ui);
export const friendViews = createFriendViews();
