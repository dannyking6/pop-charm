// Copyright (c) 2013-2016 CharmTeam

(function() {
/******************************************************************************
 * Spine Runtimes Software License
 * Version 2.3
 * 
 * Copyright (c) 2013-2015, Esoteric Software
 * All rights reserved.
 * 
 * You are granted a perpetual, non-exclusive, non-sublicensable and
 * non-transferable license to use, install, execute and perform the Spine
 * Runtimes Software (the "Software") and derivative works solely for personal
 * or internal use. Without the written permission of Esoteric Software (see
 * Section 2 of the Spine Software License Agreement), you may not (a) modify,
 * translate, adapt or otherwise create derivative works, improvements of the
 * Software or develop new applications using the Software or (b) remove,
 * delete, alter or obscure any trademarks or any copyright, trademark, patent
 * or other intellectual property or proprietary rights notices on or in the
 * Software, including any copy thereof. Redistributions in binary or source
 * form must include this license and terms.
 * 
 * THIS SOFTWARE IS PROVIDED BY ESOTERIC SOFTWARE "AS IS" AND ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO
 * EVENT SHALL ESOTERIC SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
 * OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
 * ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *****************************************************************************/

var spine = {
	radDeg: 180 / Math.PI,
	degRad: Math.PI / 180,
	temp: [],
    Float32Array: (typeof(Float32Array) === 'undefined') ? Array : Float32Array,
    Uint16Array: (typeof(Uint16Array) === 'undefined') ? Array : Uint16Array
};

spine.BoneData = function (name, parent) {
	this.name = name;
	this.parent = parent;
};
spine.BoneData.prototype = {
	length: 0,
	x: 0, y: 0,
	rotation: 0,
	scaleX: 1, scaleY: 1,
	inheritScale: true,
	inheritRotation: true,
	flipX: false, flipY: false
};

spine.BlendMode = {
	normal: 0,
	additive: 1,
	multiply: 2,
	screen: 3
};

spine.SlotData = function (name, boneData) {
	this.name = name;
	this.boneData = boneData;
};
spine.SlotData.prototype = {
	r: 1, g: 1, b: 1, a: 1,
	attachmentName: null,
	blendMode: spine.BlendMode.normal
};

spine.IkConstraintData = function (name) {
	this.name = name;
	this.bones = [];
};
spine.IkConstraintData.prototype = {
	target: null,
	bendDirection: 1,
	mix: 1
};

spine.Bone = function (boneData, skeleton, parent) {
	this.data = boneData;
	this.skeleton = skeleton;
	this.parent = parent;
	this.setToSetupPose();
};
spine.Bone.yDown = false;
spine.Bone.prototype = {
	x: 0, y: 0,
	rotation: 0, rotationIK: 0,
	scaleX: 1, scaleY: 1,
	flipX: false, flipY: false,
	m00: 0, m01: 0, worldX: 0, // a b x
	m10: 0, m11: 0, worldY: 0, // c d y
	worldRotation: 0,
	worldScaleX: 1, worldScaleY: 1,
	worldFlipX: false, worldFlipY: false,
	updateWorldTransform: function () {
		var parent = this.parent;
		if (parent) {
			this.worldX = this.x * parent.m00 + this.y * parent.m01 + parent.worldX;
			this.worldY = this.x * parent.m10 + this.y * parent.m11 + parent.worldY;
			if (this.data.inheritScale) {
				this.worldScaleX = parent.worldScaleX * this.scaleX;
				this.worldScaleY = parent.worldScaleY * this.scaleY;
			} else {
				this.worldScaleX = this.scaleX;
				this.worldScaleY = this.scaleY;
			}
			this.worldRotation = this.data.inheritRotation ? (parent.worldRotation + this.rotationIK) : this.rotationIK;
			this.worldFlipX = parent.worldFlipX != this.flipX;
			this.worldFlipY = parent.worldFlipY != this.flipY;
		} else {
			var skeletonFlipX = this.skeleton.flipX, skeletonFlipY = this.skeleton.flipY;
			this.worldX = skeletonFlipX ? -this.x : this.x;
			this.worldY = (skeletonFlipY != spine.Bone.yDown) ? -this.y : this.y;
			this.worldScaleX = this.scaleX;
			this.worldScaleY = this.scaleY;
			this.worldRotation = this.rotationIK;
			this.worldFlipX = skeletonFlipX != this.flipX;
			this.worldFlipY = skeletonFlipY != this.flipY;
		}
		var radians = this.worldRotation * spine.degRad;
		var cos = Math.cos(radians);
		var sin = Math.sin(radians);
		if (this.worldFlipX) {
			this.m00 = -cos * this.worldScaleX;
			this.m01 = sin * this.worldScaleY;
		} else {
			this.m00 = cos * this.worldScaleX;
			this.m01 = -sin * this.worldScaleY;
		}
		if (this.worldFlipY != spine.Bone.yDown) {
			this.m10 = -sin * this.worldScaleX;
			this.m11 = -cos * this.worldScaleY;
		} else {
			this.m10 = sin * this.worldScaleX;
			this.m11 = cos * this.worldScaleY;
		}
	},
	setToSetupPose: function () {
		var data = this.data;
		this.x = data.x;
		this.y = data.y;
		this.rotation = data.rotation;
		this.rotationIK = this.rotation;
		this.scaleX = data.scaleX;
		this.scaleY = data.scaleY;
		this.flipX = data.flipX;
		this.flipY = data.flipY;
	},
	worldToLocal: function (world) {
		var dx = world[0] - this.worldX, dy = world[1] - this.worldY;
		var m00 = this.m00, m10 = this.m10, m01 = this.m01, m11 = this.m11;
		if (this.worldFlipX != (this.worldFlipY != spine.Bone.yDown)) {
			m00 = -m00;
			m11 = -m11;
		}
		var invDet = 1 / (m00 * m11 - m01 * m10);
		world[0] = dx * m00 * invDet - dy * m01 * invDet;
		world[1] = dy * m11 * invDet - dx * m10 * invDet;
	},
	localToWorld: function (local) {
		var localX = local[0], localY = local[1];
		local[0] = localX * this.m00 + localY * this.m01 + this.worldX;
		local[1] = localX * this.m10 + localY * this.m11 + this.worldY;
	}
};

spine.Slot = function (slotData, bone) {
	this.data = slotData;
	this.bone = bone;
	this.setToSetupPose();
};
spine.Slot.prototype = {
	r: 1, g: 1, b: 1, a: 1,
	_attachmentTime: 0,
	attachment: null,
	attachmentVertices: [],
	setAttachment: function (attachment) {
		if (this.attachment == attachment) return;
		this.attachment = attachment;
		this._attachmentTime = this.bone.skeleton.time;
		this.attachmentVertices.length = 0;
	},
	setAttachmentTime: function (time) {
		this._attachmentTime = this.bone.skeleton.time - time;
	},
	getAttachmentTime: function () {
		return this.bone.skeleton.time - this._attachmentTime;
	},
	setToSetupPose: function () {
		var data = this.data;
		this.r = data.r;
		this.g = data.g;
		this.b = data.b;
		this.a = data.a;

		if (!data.attachmentName)
			this.setAttachment(null);
		else {
			var slotDatas = this.bone.skeleton.data.slots;
			for (var i = 0, n = slotDatas.length; i < n; i++) {
				if (slotDatas[i] == data) {
					this.attachment = null;
					this.setAttachment(this.bone.skeleton.getAttachmentBySlotIndex(i, data.attachmentName));
					break;
				}
			}
		}
	}
};

spine.IkConstraint = function (data, skeleton) {
	this.data = data;
	this.mix = data.mix;
	this.bendDirection = data.bendDirection;

	this.bones = [];
	for (var i = 0, n = data.bones.length; i < n; i++)
		this.bones.push(skeleton.findBone(data.bones[i].name));
	this.target = skeleton.findBone(data.target.name);
};
spine.IkConstraint.prototype = {
	apply: function () {
		var target = this.target;
		var bones = this.bones;
		switch (bones.length) {
		case 1:
			spine.IkConstraint.apply1(bones[0], target.worldX, target.worldY, this.mix);
			break;
		case 2:
			spine.IkConstraint.apply2(bones[0], bones[1], target.worldX, target.worldY, this.bendDirection, this.mix);
			break;
		}
	}
};
/** Adjusts the bone rotation so the tip is as close to the target position as possible. The target is specified in the world
 * coordinate system. */
spine.IkConstraint.apply1 = function (bone, targetX, targetY, alpha) {
	var parentRotation = (!bone.data.inheritRotation || !bone.parent) ? 0 : bone.parent.worldRotation;
	var rotation = bone.rotation;
	var rotationIK = Math.atan2(targetY - bone.worldY, targetX - bone.worldX) * spine.radDeg;
	if (bone.worldFlipX != (bone.worldFlipY != spine.Bone.yDown)) rotationIK = -rotationIK;
	rotationIK -= parentRotation;
	bone.rotationIK = rotation + (rotationIK - rotation) * alpha;
};
/** Adjusts the parent and child bone rotations so the tip of the child is as close to the target position as possible. The
 * target is specified in the world coordinate system.
 * @param child Any descendant bone of the parent. */
spine.IkConstraint.apply2 = function (parent, child, targetX, targetY, bendDirection, alpha) {
	var childRotation = child.rotation, parentRotation = parent.rotation;
	if (!alpha) {
		child.rotationIK = childRotation;
		parent.rotationIK = parentRotation;
		return;
	}
	var positionX, positionY, tempPosition = spine.temp;
	var parentParent = parent.parent;
	if (parentParent) {
		tempPosition[0] = targetX;
		tempPosition[1] = targetY;
		parentParent.worldToLocal(tempPosition);
		targetX = (tempPosition[0] - parent.x) * parentParent.worldScaleX;
		targetY = (tempPosition[1] - parent.y) * parentParent.worldScaleY;
	} else {
		targetX -= parent.x;
		targetY -= parent.y;
	}
	if (child.parent == parent) {
		positionX = child.x;
		positionY = child.y;
	} else {
		tempPosition[0] = child.x;
		tempPosition[1] = child.y;
		child.parent.localToWorld(tempPosition);
		parent.worldToLocal(tempPosition);
		positionX = tempPosition[0];
		positionY = tempPosition[1];
	}
	var childX = positionX * parent.worldScaleX, childY = positionY * parent.worldScaleY;
	var offset = Math.atan2(childY, childX);
	var len1 = Math.sqrt(childX * childX + childY * childY), len2 = child.data.length * child.worldScaleX;
	// Based on code by Ryan Juckett with permission: Copyright (c) 2008-2009 Ryan Juckett, http://www.ryanjuckett.com/
	var cosDenom = 2 * len1 * len2;
	if (cosDenom < 0.0001) {
		child.rotationIK = childRotation + (Math.atan2(targetY, targetX) * spine.radDeg - parentRotation - childRotation) * alpha;
		return;
	}
	var cos = (targetX * targetX + targetY * targetY - len1 * len1 - len2 * len2) / cosDenom;
	if (cos < -1)
		cos = -1;
	else if (cos > 1)
		cos = 1;
	var childAngle = Math.acos(cos) * bendDirection;
	var adjacent = len1 + len2 * cos, opposite = len2 * Math.sin(childAngle);
	var parentAngle = Math.atan2(targetY * adjacent - targetX * opposite, targetX * adjacent + targetY * opposite);
	var rotation = (parentAngle - offset) * spine.radDeg - parentRotation;
	if (rotation > 180)
		rotation -= 360;
	else if (rotation < -180) //
		rotation += 360;
	parent.rotationIK = parentRotation + rotation * alpha;
	rotation = (childAngle + offset) * spine.radDeg - childRotation;
	if (rotation > 180)
		rotation -= 360;
	else if (rotation < -180) //
		rotation += 360;
	child.rotationIK = childRotation + (rotation + parent.worldRotation - child.parent.worldRotation) * alpha;
};

spine.Skin = function (name) {
	this.name = name;
	this.attachments = {};
};
spine.Skin.prototype = {
	addAttachment: function (slotIndex, name, attachment) {
		this.attachments[slotIndex + ":" + name] = attachment;
	},
	getAttachment: function (slotIndex, name) {
		return this.attachments[slotIndex + ":" + name];
	},
	_attachAll: function (skeleton, oldSkin) {
		for (var key in oldSkin.attachments) {
			var colon = key.indexOf(":");
			var slotIndex = parseInt(key.substring(0, colon));
			var name = key.substring(colon + 1);
			var slot = skeleton.slots[slotIndex];
			if (slot.attachment && slot.attachment.name == name) {
				var attachment = this.getAttachment(slotIndex, name);
				if (attachment) slot.setAttachment(attachment);
			}
		}
	}
};

spine.Animation = function (name, timelines, duration) {
	this.name = name;
	this.timelines = timelines;
	this.duration = duration;
};
spine.Animation.prototype = {
	apply: function (skeleton, lastTime, time, loop, events) {
		if (loop && this.duration != 0) {
			time %= this.duration;
			lastTime %= this.duration;
		}
		var timelines = this.timelines;
		for (var i = 0, n = timelines.length; i < n; i++)
			timelines[i].apply(skeleton, lastTime, time, events, 1);
	},
	mix: function (skeleton, lastTime, time, loop, events, alpha) {
		if (loop && this.duration != 0) {
			time %= this.duration;
			lastTime %= this.duration;
		}
		var timelines = this.timelines;
		for (var i = 0, n = timelines.length; i < n; i++)
			timelines[i].apply(skeleton, lastTime, time, events, alpha);
	}
};
spine.Animation.binarySearch = function (values, target, step) {
	var low = 0;
	var high = Math.floor(values.length / step) - 2;
	if (!high) return step;
	var current = high >>> 1;
	while (true) {
		if (values[(current + 1) * step] <= target)
			low = current + 1;
		else
			high = current;
		if (low == high) return (low + 1) * step;
		current = (low + high) >>> 1;
	}
};
spine.Animation.binarySearch1 = function (values, target) {
	var low = 0;
	var high = values.length - 2;
	if (!high) return 1;
	var current = high >>> 1;
	while (true) {
		if (values[current + 1] <= target)
			low = current + 1;
		else
			high = current;
		if (low == high) return low + 1;
		current = (low + high) >>> 1;
	}
};
spine.Animation.linearSearch = function (values, target, step) {
	for (var i = 0, last = values.length - step; i <= last; i += step)
		if (values[i] > target) return i;
	return -1;
};

spine.Curves = function (frameCount) {
	this.curves = []; // type, x, y, ...
	//this.curves.length = (frameCount - 1) * 19/*BEZIER_SIZE*/;
};
spine.Curves.prototype = {
	setLinear: function (frameIndex) {
		this.curves[frameIndex * 19/*BEZIER_SIZE*/] = 0/*LINEAR*/;
	},
	setStepped: function (frameIndex) {
		this.curves[frameIndex * 19/*BEZIER_SIZE*/] = 1/*STEPPED*/;
	},
	/** Sets the control handle positions for an interpolation bezier curve used to transition from this keyframe to the next.
	 * cx1 and cx2 are from 0 to 1, representing the percent of time between the two keyframes. cy1 and cy2 are the percent of
	 * the difference between the keyframe's values. */
	setCurve: function (frameIndex, cx1, cy1, cx2, cy2) {
		var subdiv1 = 1 / 10/*BEZIER_SEGMENTS*/, subdiv2 = subdiv1 * subdiv1, subdiv3 = subdiv2 * subdiv1;
		var pre1 = 3 * subdiv1, pre2 = 3 * subdiv2, pre4 = 6 * subdiv2, pre5 = 6 * subdiv3;
		var tmp1x = -cx1 * 2 + cx2, tmp1y = -cy1 * 2 + cy2, tmp2x = (cx1 - cx2) * 3 + 1, tmp2y = (cy1 - cy2) * 3 + 1;
		var dfx = cx1 * pre1 + tmp1x * pre2 + tmp2x * subdiv3, dfy = cy1 * pre1 + tmp1y * pre2 + tmp2y * subdiv3;
		var ddfx = tmp1x * pre4 + tmp2x * pre5, ddfy = tmp1y * pre4 + tmp2y * pre5;
		var dddfx = tmp2x * pre5, dddfy = tmp2y * pre5;

		var i = frameIndex * 19/*BEZIER_SIZE*/;
		var curves = this.curves;
		curves[i++] = 2/*BEZIER*/;
		
		var x = dfx, y = dfy;
		for (var n = i + 19/*BEZIER_SIZE*/ - 1; i < n; i += 2) {
			curves[i] = x;
			curves[i + 1] = y;
			dfx += ddfx;
			dfy += ddfy;
			ddfx += dddfx;
			ddfy += dddfy;
			x += dfx;
			y += dfy;
		}
	},
	getCurvePercent: function (frameIndex, percent) {
		percent = percent < 0 ? 0 : (percent > 1 ? 1 : percent);
		var curves = this.curves;
		var i = frameIndex * 19/*BEZIER_SIZE*/;
		var type = curves[i];
		if (type === 0/*LINEAR*/) return percent;
		if (type == 1/*STEPPED*/) return 0;
		i++;
		var x = 0;
		for (var start = i, n = i + 19/*BEZIER_SIZE*/ - 1; i < n; i += 2) {
			x = curves[i];
			if (x >= percent) {
				var prevX, prevY;
				if (i == start) {
					prevX = 0;
					prevY = 0;
				} else {
					prevX = curves[i - 2];
					prevY = curves[i - 1];
				}
				return prevY + (curves[i + 1] - prevY) * (percent - prevX) / (x - prevX);
			}
		}
		var y = curves[i - 1];
		return y + (1 - y) * (percent - x) / (1 - x); // Last point is 1,1.
	}
};

spine.RotateTimeline = function (frameCount) {
	this.curves = new spine.Curves(frameCount);
	this.frames = []; // time, angle, ...
	this.frames.length = frameCount * 2;
};
spine.RotateTimeline.prototype = {
	boneIndex: 0,
	getFrameCount: function () {
		return this.frames.length / 2;
	},
	setFrame: function (frameIndex, time, angle) {
		frameIndex *= 2;
		this.frames[frameIndex] = time;
		this.frames[frameIndex + 1] = angle;
	},
	apply: function (skeleton, lastTime, time, firedEvents, alpha) {
		var frames = this.frames;
		if (time < frames[0]) return; // Time is before first frame.

		var bone = skeleton.bones[this.boneIndex];

		if (time >= frames[frames.length - 2]) { // Time is after last frame.
			var amount = bone.data.rotation + frames[frames.length - 1] - bone.rotation;
			while (amount > 180)
				amount -= 360;
			while (amount < -180)
				amount += 360;
			bone.rotation += amount * alpha;
			return;
		}

		// Interpolate between the previous frame and the current frame.
		var frameIndex = spine.Animation.binarySearch(frames, time, 2);
		var prevFrameValue = frames[frameIndex - 1];
		var frameTime = frames[frameIndex];
		var percent = 1 - (time - frameTime) / (frames[frameIndex - 2/*PREV_FRAME_TIME*/] - frameTime);
		percent = this.curves.getCurvePercent(frameIndex / 2 - 1, percent);

		var amount = frames[frameIndex + 1/*FRAME_VALUE*/] - prevFrameValue;
		while (amount > 180)
			amount -= 360;
		while (amount < -180)
			amount += 360;
		amount = bone.data.rotation + (prevFrameValue + amount * percent) - bone.rotation;
		while (amount > 180)
			amount -= 360;
		while (amount < -180)
			amount += 360;
		bone.rotation += amount * alpha;
	}
};

spine.TranslateTimeline = function (frameCount) {
	this.curves = new spine.Curves(frameCount);
	this.frames = []; // time, x, y, ...
	this.frames.length = frameCount * 3;
};
spine.TranslateTimeline.prototype = {
	boneIndex: 0,
	getFrameCount: function () {
		return this.frames.length / 3;
	},
	setFrame: function (frameIndex, time, x, y) {
		frameIndex *= 3;
		this.frames[frameIndex] = time;
		this.frames[frameIndex + 1] = x;
		this.frames[frameIndex + 2] = y;
	},
	apply: function (skeleton, lastTime, time, firedEvents, alpha) {
		var frames = this.frames;
		if (time < frames[0]) return; // Time is before first frame.

		var bone = skeleton.bones[this.boneIndex];

		if (time >= frames[frames.length - 3]) { // Time is after last frame.
			bone.x += (bone.data.x + frames[frames.length - 2] - bone.x) * alpha;
			bone.y += (bone.data.y + frames[frames.length - 1] - bone.y) * alpha;
			return;
		}

		// Interpolate between the previous frame and the current frame.
		var frameIndex = spine.Animation.binarySearch(frames, time, 3);
		var prevFrameX = frames[frameIndex - 2];
		var prevFrameY = frames[frameIndex - 1];
		var frameTime = frames[frameIndex];
		var percent = 1 - (time - frameTime) / (frames[frameIndex + -3/*PREV_FRAME_TIME*/] - frameTime);
		percent = this.curves.getCurvePercent(frameIndex / 3 - 1, percent);

		bone.x += (bone.data.x + prevFrameX + (frames[frameIndex + 1/*FRAME_X*/] - prevFrameX) * percent - bone.x) * alpha;
		bone.y += (bone.data.y + prevFrameY + (frames[frameIndex + 2/*FRAME_Y*/] - prevFrameY) * percent - bone.y) * alpha;
	}
};

spine.ScaleTimeline = function (frameCount) {
	this.curves = new spine.Curves(frameCount);
	this.frames = []; // time, x, y, ...
	this.frames.length = frameCount * 3;
};
spine.ScaleTimeline.prototype = {
	boneIndex: 0,
	getFrameCount: function () {
		return this.frames.length / 3;
	},
	setFrame: function (frameIndex, time, x, y) {
		frameIndex *= 3;
		this.frames[frameIndex] = time;
		this.frames[frameIndex + 1] = x;
		this.frames[frameIndex + 2] = y;
	},
	apply: function (skeleton, lastTime, time, firedEvents, alpha) {
		var frames = this.frames;
		if (time < frames[0]) return; // Time is before first frame.

		var bone = skeleton.bones[this.boneIndex];

		if (time >= frames[frames.length - 3]) { // Time is after last frame.
			bone.scaleX += (bone.data.scaleX * frames[frames.length - 2] - bone.scaleX) * alpha;
			bone.scaleY += (bone.data.scaleY * frames[frames.length - 1] - bone.scaleY) * alpha;
			return;
		}

		// Interpolate between the previous frame and the current frame.
		var frameIndex = spine.Animation.binarySearch(frames, time, 3);
		var prevFrameX = frames[frameIndex - 2];
		var prevFrameY = frames[frameIndex - 1];
		var frameTime = frames[frameIndex];
		var percent = 1 - (time - frameTime) / (frames[frameIndex + -3/*PREV_FRAME_TIME*/] - frameTime);
		percent = this.curves.getCurvePercent(frameIndex / 3 - 1, percent);

		bone.scaleX += (bone.data.scaleX * (prevFrameX + (frames[frameIndex + 1/*FRAME_X*/] - prevFrameX) * percent) - bone.scaleX) * alpha;
		bone.scaleY += (bone.data.scaleY * (prevFrameY + (frames[frameIndex + 2/*FRAME_Y*/] - prevFrameY) * percent) - bone.scaleY) * alpha;
	}
};

spine.ColorTimeline = function (frameCount) {
	this.curves = new spine.Curves(frameCount);
	this.frames = []; // time, r, g, b, a, ...
	this.frames.length = frameCount * 5;
};
spine.ColorTimeline.prototype = {
	slotIndex: 0,
	getFrameCount: function () {
		return this.frames.length / 5;
	},
	setFrame: function (frameIndex, time, r, g, b, a) {
		frameIndex *= 5;
		this.frames[frameIndex] = time;
		this.frames[frameIndex + 1] = r;
		this.frames[frameIndex + 2] = g;
		this.frames[frameIndex + 3] = b;
		this.frames[frameIndex + 4] = a;
	},
	apply: function (skeleton, lastTime, time, firedEvents, alpha) {
		var frames = this.frames;
		if (time < frames[0]) return; // Time is before first frame.

		var r, g, b, a;
		if (time >= frames[frames.length - 5]) {
			// Time is after last frame.
			var i = frames.length - 1;
			r = frames[i - 3];
			g = frames[i - 2];
			b = frames[i - 1];
			a = frames[i];
		} else {
			// Interpolate between the previous frame and the current frame.
			var frameIndex = spine.Animation.binarySearch(frames, time, 5);
			var prevFrameR = frames[frameIndex - 4];
			var prevFrameG = frames[frameIndex - 3];
			var prevFrameB = frames[frameIndex - 2];
			var prevFrameA = frames[frameIndex - 1];
			var frameTime = frames[frameIndex];
			var percent = 1 - (time - frameTime) / (frames[frameIndex - 5/*PREV_FRAME_TIME*/] - frameTime);
			percent = this.curves.getCurvePercent(frameIndex / 5 - 1, percent);

			r = prevFrameR + (frames[frameIndex + 1/*FRAME_R*/] - prevFrameR) * percent;
			g = prevFrameG + (frames[frameIndex + 2/*FRAME_G*/] - prevFrameG) * percent;
			b = prevFrameB + (frames[frameIndex + 3/*FRAME_B*/] - prevFrameB) * percent;
			a = prevFrameA + (frames[frameIndex + 4/*FRAME_A*/] - prevFrameA) * percent;
		}
		var slot = skeleton.slots[this.slotIndex];
		if (alpha < 1) {
			slot.r += (r - slot.r) * alpha;
			slot.g += (g - slot.g) * alpha;
			slot.b += (b - slot.b) * alpha;
			slot.a += (a - slot.a) * alpha;
		} else {
			slot.r = r;
			slot.g = g;
			slot.b = b;
			slot.a = a;
		}
	}
};

spine.AttachmentTimeline = function (frameCount) {
	this.curves = new spine.Curves(frameCount);
	this.frames = []; // time, ...
	this.frames.length = frameCount;
	this.attachmentNames = [];
	this.attachmentNames.length = frameCount;
};
spine.AttachmentTimeline.prototype = {
	slotIndex: 0,
	getFrameCount: function () {
		return this.frames.length;
	},
	setFrame: function (frameIndex, time, attachmentName) {
		this.frames[frameIndex] = time;
		this.attachmentNames[frameIndex] = attachmentName;
	},
	apply: function (skeleton, lastTime, time, firedEvents, alpha) {
		var frames = this.frames;
		if (time < frames[0]) {
			if (lastTime > time) this.apply(skeleton, lastTime, Number.MAX_VALUE, null, 0);
			return;
		} else if (lastTime > time) //
			lastTime = -1;

		var frameIndex = time >= frames[frames.length - 1] ? frames.length - 1 : spine.Animation.binarySearch1(frames, time) - 1;
		if (frames[frameIndex] < lastTime) return;

		var attachmentName = this.attachmentNames[frameIndex];
		skeleton.slots[this.slotIndex].setAttachment(
			!attachmentName ? null : skeleton.getAttachmentBySlotIndex(this.slotIndex, attachmentName));
	}
};

spine.EventTimeline = function (frameCount) {
	this.frames = []; // time, ...
	this.frames.length = frameCount;
	this.events = [];
	this.events.length = frameCount;
};
spine.EventTimeline.prototype = {
	getFrameCount: function () {
		return this.frames.length;
	},
	setFrame: function (frameIndex, time, event) {
		this.frames[frameIndex] = time;
		this.events[frameIndex] = event;
	},
	/** Fires events for frames > lastTime and <= time. */
	apply: function (skeleton, lastTime, time, firedEvents, alpha) {
		if (!firedEvents) return;

		var frames = this.frames;
		var frameCount = frames.length;

		if (lastTime > time) { // Fire events after last time for looped animations.
			this.apply(skeleton, lastTime, Number.MAX_VALUE, firedEvents, alpha);
			lastTime = -1;
		} else if (lastTime >= frames[frameCount - 1]) // Last time is after last frame.
			return;
		if (time < frames[0]) return; // Time is before first frame.

		var frameIndex;
		if (lastTime < frames[0])
			frameIndex = 0;
		else {
			frameIndex = spine.Animation.binarySearch1(frames, lastTime);
			var frame = frames[frameIndex];
			while (frameIndex > 0) { // Fire multiple events with the same frame.
				if (frames[frameIndex - 1] != frame) break;
				frameIndex--;
			}
		}
		var events = this.events;
		for (; frameIndex < frameCount && time >= frames[frameIndex]; frameIndex++)
			firedEvents.push(events[frameIndex]);
	}
};

spine.DrawOrderTimeline = function (frameCount) {
	this.frames = []; // time, ...
	this.frames.length = frameCount;
	this.drawOrders = [];
	this.drawOrders.length = frameCount;
};
spine.DrawOrderTimeline.prototype = {
	getFrameCount: function () {
		return this.frames.length;
	},
	setFrame: function (frameIndex, time, drawOrder) {
		this.frames[frameIndex] = time;
		this.drawOrders[frameIndex] = drawOrder;
	},
	apply: function (skeleton, lastTime, time, firedEvents, alpha) {
		var frames = this.frames;
		if (time < frames[0]) return; // Time is before first frame.

		var frameIndex;
		if (time >= frames[frames.length - 1]) // Time is after last frame.
			frameIndex = frames.length - 1;
		else
			frameIndex = spine.Animation.binarySearch1(frames, time) - 1;

		var drawOrder = skeleton.drawOrder;
		var slots = skeleton.slots;
		var drawOrderToSetupIndex = this.drawOrders[frameIndex];
		if (!drawOrderToSetupIndex) {
			for (var i = 0, n = slots.length; i < n; i++)
				drawOrder[i] = slots[i];
		} else {
			for (var i = 0, n = drawOrderToSetupIndex.length; i < n; i++)
				drawOrder[i] = skeleton.slots[drawOrderToSetupIndex[i]];
		}

	}
};

spine.FfdTimeline = function (frameCount) {
	this.curves = new spine.Curves(frameCount);
	this.frames = [];
	this.frames.length = frameCount;
	this.frameVertices = [];
	this.frameVertices.length = frameCount;
};
spine.FfdTimeline.prototype = {
	slotIndex: 0,
	attachment: 0,
	getFrameCount: function () {
		return this.frames.length;
	},
	setFrame: function (frameIndex, time, vertices) {
		this.frames[frameIndex] = time;
		this.frameVertices[frameIndex] = vertices;
	},
	apply: function (skeleton, lastTime, time, firedEvents, alpha) {
		var slot = skeleton.slots[this.slotIndex];
		if (slot.attachment != this.attachment) return;

		var frames = this.frames;
		if (time < frames[0]) return; // Time is before first frame.

		var frameVertices = this.frameVertices;
		var vertexCount = frameVertices[0].length;

		var vertices = slot.attachmentVertices;
		if (vertices.length != vertexCount) alpha = 1;
		vertices.length = vertexCount;

		if (time >= frames[frames.length - 1]) { // Time is after last frame.
			var lastVertices = frameVertices[frames.length - 1];
			if (alpha < 1) {
				for (var i = 0; i < vertexCount; i++)
					vertices[i] += (lastVertices[i] - vertices[i]) * alpha;
			} else {
				for (var i = 0; i < vertexCount; i++)
					vertices[i] = lastVertices[i];
			}
			return;
		}

		// Interpolate between the previous frame and the current frame.
		var frameIndex = spine.Animation.binarySearch1(frames, time);
		var frameTime = frames[frameIndex];
		var percent = 1 - (time - frameTime) / (frames[frameIndex - 1] - frameTime);
		percent = this.curves.getCurvePercent(frameIndex - 1, percent < 0 ? 0 : (percent > 1 ? 1 : percent));

		var prevVertices = frameVertices[frameIndex - 1];
		var nextVertices = frameVertices[frameIndex];

		if (alpha < 1) {
			for (var i = 0; i < vertexCount; i++) {
				var prev = prevVertices[i];
				vertices[i] += (prev + (nextVertices[i] - prev) * percent - vertices[i]) * alpha;
			}
		} else {
			for (var i = 0; i < vertexCount; i++) {
				var prev = prevVertices[i];
				vertices[i] = prev + (nextVertices[i] - prev) * percent;
			}
		}
	}
};

spine.IkConstraintTimeline = function (frameCount) {
	this.curves = new spine.Curves(frameCount);
	this.frames = []; // time, mix, bendDirection, ...
	this.frames.length = frameCount * 3;
};
spine.IkConstraintTimeline.prototype = {
	ikConstraintIndex: 0,
	getFrameCount: function () {
		return this.frames.length / 3;
	},
	setFrame: function (frameIndex, time, mix, bendDirection) {
		frameIndex *= 3;
		this.frames[frameIndex] = time;
		this.frames[frameIndex + 1] = mix;
		this.frames[frameIndex + 2] = bendDirection;
	},
	apply: function (skeleton, lastTime, time, firedEvents, alpha) {
		var frames = this.frames;
		if (time < frames[0]) return; // Time is before first frame.

		var ikConstraint = skeleton.ikConstraints[this.ikConstraintIndex];

		if (time >= frames[frames.length - 3]) { // Time is after last frame.
			ikConstraint.mix += (frames[frames.length - 2] - ikConstraint.mix) * alpha;
			ikConstraint.bendDirection = frames[frames.length - 1];
			return;
		}

		// Interpolate between the previous frame and the current frame.
		var frameIndex = spine.Animation.binarySearch(frames, time, 3);
		var prevFrameMix = frames[frameIndex + -2/*PREV_FRAME_MIX*/];
		var frameTime = frames[frameIndex];
		var percent = 1 - (time - frameTime) / (frames[frameIndex + -3/*PREV_FRAME_TIME*/] - frameTime);
		percent = this.curves.getCurvePercent(frameIndex / 3 - 1, percent);

		var mix = prevFrameMix + (frames[frameIndex + 1/*FRAME_MIX*/] - prevFrameMix) * percent;
		ikConstraint.mix += (mix - ikConstraint.mix) * alpha;
		ikConstraint.bendDirection = frames[frameIndex + -1/*PREV_FRAME_BEND_DIRECTION*/];
	}
};

spine.FlipXTimeline = function (frameCount) {
	this.curves = new spine.Curves(frameCount);
	this.frames = []; // time, flip, ...
	this.frames.length = frameCount * 2;
};
spine.FlipXTimeline.prototype = {
	boneIndex: 0,
	getFrameCount: function () {
		return this.frames.length / 2;
	},
	setFrame: function (frameIndex, time, flip) {
		frameIndex *= 2;
		this.frames[frameIndex] = time;
		this.frames[frameIndex + 1] = flip ? 1 : 0;
	},
	apply: function (skeleton, lastTime, time, firedEvents, alpha) {
		var frames = this.frames;
		if (time < frames[0]) {
			if (lastTime > time) this.apply(skeleton, lastTime, Number.MAX_VALUE, null, 0);
			return;
		} else if (lastTime > time) //
			lastTime = -1;
		var frameIndex = (time >= frames[frames.length - 2] ? frames.length : spine.Animation.binarySearch(frames, time, 2)) - 2;
		if (frames[frameIndex] < lastTime) return;
		skeleton.bones[this.boneIndex].flipX = frames[frameIndex + 1] != 0;
	}
};

spine.FlipYTimeline = function (frameCount) {
	this.curves = new spine.Curves(frameCount);
	this.frames = []; // time, flip, ...
	this.frames.length = frameCount * 2;
};
spine.FlipYTimeline.prototype = {
	boneIndex: 0,
	getFrameCount: function () {
		return this.frames.length / 2;
	},
	setFrame: function (frameIndex, time, flip) {
		frameIndex *= 2;
		this.frames[frameIndex] = time;
		this.frames[frameIndex + 1] = flip ? 1 : 0;
	},
	apply: function (skeleton, lastTime, time, firedEvents, alpha) {
		var frames = this.frames;
		if (time < frames[0]) {
			if (lastTime > time) this.apply(skeleton, lastTime, Number.MAX_VALUE, null, 0);
			return;
		} else if (lastTime > time) //
			lastTime = -1;
		var frameIndex = (time >= frames[frames.length - 2] ? frames.length : spine.Animation.binarySearch(frames, time, 2)) - 2;
		if (frames[frameIndex] < lastTime) return;
		skeleton.bones[this.boneIndex].flipY = frames[frameIndex + 1] != 0;
	}
};

spine.SkeletonData = function () {
	this.bones = [];
	this.slots = [];
	this.skins = [];
	this.events = [];
	this.animations = [];
	this.ikConstraints = [];
};
spine.SkeletonData.prototype = {
	name: null,
	defaultSkin: null,
	width: 0, height: 0,
	version: null, hash: null,
	/** @return May be null. */
	findBone: function (boneName) {
		var bones = this.bones;
		for (var i = 0, n = bones.length; i < n; i++)
			if (bones[i].name == boneName) return bones[i];
		return null;
	},
	/** @return -1 if the bone was not found. */
	findBoneIndex: function (boneName) {
		var bones = this.bones;
		for (var i = 0, n = bones.length; i < n; i++)
			if (bones[i].name == boneName) return i;
		return -1;
	},
	/** @return May be null. */
	findSlot: function (slotName) {
		var slots = this.slots;
		for (var i = 0, n = slots.length; i < n; i++) {
			if (slots[i].name == slotName) return slot[i];
		}
		return null;
	},
	/** @return -1 if the bone was not found. */
	findSlotIndex: function (slotName) {
		var slots = this.slots;
		for (var i = 0, n = slots.length; i < n; i++)
			if (slots[i].name == slotName) return i;
		return -1;
	},
	/** @return May be null. */
	findSkin: function (skinName) {
		var skins = this.skins;
		for (var i = 0, n = skins.length; i < n; i++)
			if (skins[i].name == skinName) return skins[i];
		return null;
	},
	/** @return May be null. */
	findEvent: function (eventName) {
		var events = this.events;
		for (var i = 0, n = events.length; i < n; i++)
			if (events[i].name == eventName) return events[i];
		return null;
	},
	/** @return May be null. */
	findAnimation: function (animationName) {
		var animations = this.animations;
		for (var i = 0, n = animations.length; i < n; i++)
			if (animations[i].name == animationName) return animations[i];
		return null;
	},
	/** @return May be null. */
	findIkConstraint: function (ikConstraintName) {
		var ikConstraints = this.ikConstraints;
		for (var i = 0, n = ikConstraints.length; i < n; i++)
			if (ikConstraints[i].name == ikConstraintName) return ikConstraints[i];
		return null;
	}
};

spine.Skeleton = function (skeletonData) {
	this.data = skeletonData;

	this.bones = [];
	for (var i = 0, n = skeletonData.bones.length; i < n; i++) {
		var boneData = skeletonData.bones[i];
		var parent = !boneData.parent ? null : this.bones[skeletonData.bones.indexOf(boneData.parent)];
		this.bones.push(new spine.Bone(boneData, this, parent));
	}

	this.slots = [];
	this.drawOrder = [];
	for (var i = 0, n = skeletonData.slots.length; i < n; i++) {
		var slotData = skeletonData.slots[i];
		var bone = this.bones[skeletonData.bones.indexOf(slotData.boneData)];
		var slot = new spine.Slot(slotData, bone);
		this.slots.push(slot);
		this.drawOrder.push(slot);
	}
	
	this.ikConstraints = [];
	for (var i = 0, n = skeletonData.ikConstraints.length; i < n; i++)
		this.ikConstraints.push(new spine.IkConstraint(skeletonData.ikConstraints[i], this));

	this.boneCache = [];
	this.updateCache();
};
spine.Skeleton.prototype = {
	x: 0, y: 0,
	skin: null,
	r: 1, g: 1, b: 1, a: 1,
	time: 0,
	flipX: false, flipY: false,
	/** Caches information about bones and IK constraints. Must be called if bones or IK constraints are added or removed. */
	updateCache: function () {
		var ikConstraints = this.ikConstraints;
		var ikConstraintsCount = ikConstraints.length;

		var arrayCount = ikConstraintsCount + 1;
		var boneCache = this.boneCache;
		if (boneCache.length > arrayCount) boneCache.length = arrayCount;
		for (var i = 0, n = boneCache.length; i < n; i++)
			boneCache[i].length = 0;
		while (boneCache.length < arrayCount)
			boneCache[boneCache.length] = [];

		var nonIkBones = boneCache[0];
		var bones = this.bones;

		outer:
		for (var i = 0, n = bones.length; i < n; i++) {
			var bone = bones[i];
			var current = bone;
			do {
				for (var ii = 0; ii < ikConstraintsCount; ii++) {
					var ikConstraint = ikConstraints[ii];
					var parent = ikConstraint.bones[0];
					var child= ikConstraint.bones[ikConstraint.bones.length - 1];
					while (true) {
						if (current == child) {
							boneCache[ii].push(bone);
							boneCache[ii + 1].push(bone);
							continue outer;
						}
						if (child == parent) break;
						child = child.parent;
					}
				}
				current = current.parent;
			} while (current);
			nonIkBones[nonIkBones.length] = bone;
		}
	},
	/** Updates the world transform for each bone. */
	updateWorldTransform: function () {
		var bones = this.bones;
		for (var i = 0, n = bones.length; i < n; i++) {
			var bone = bones[i];
			bone.rotationIK = bone.rotation;
		}
		var i = 0, last = this.boneCache.length - 1;
		while (true) {
			var cacheBones = this.boneCache[i];
			for (var ii = 0, nn = cacheBones.length; ii < nn; ii++)
				cacheBones[ii].updateWorldTransform();
			if (i == last) break;
			this.ikConstraints[i].apply();
			i++;
		}
	},
	/** Sets the bones and slots to their setup pose values. */
	setToSetupPose: function () {
		this.setBonesToSetupPose();
		this.setSlotsToSetupPose();
	},
	setBonesToSetupPose: function () {
		var bones = this.bones;
		for (var i = 0, n = bones.length; i < n; i++)
			bones[i].setToSetupPose();

		var ikConstraints = this.ikConstraints;
		for (var i = 0, n = ikConstraints.length; i < n; i++) {
			var ikConstraint = ikConstraints[i];
			ikConstraint.bendDirection = ikConstraint.data.bendDirection;
			ikConstraint.mix = ikConstraint.data.mix;
		}
	},
	setSlotsToSetupPose: function () {
		var slots = this.slots;
		var drawOrder = this.drawOrder;
		for (var i = 0, n = slots.length; i < n; i++) {
			drawOrder[i] = slots[i];
			slots[i].setToSetupPose(i);
		}
	},
	/** @return May return null. */
	getRootBone: function () {
		return this.bones.length ? this.bones[0] : null;
	},
	/** @return May be null. */
	findBone: function (boneName) {
		var bones = this.bones;
		for (var i = 0, n = bones.length; i < n; i++)
			if (bones[i].data.name == boneName) return bones[i];
		return null;
	},
	/** @return -1 if the bone was not found. */
	findBoneIndex: function (boneName) {
		var bones = this.bones;
		for (var i = 0, n = bones.length; i < n; i++)
			if (bones[i].data.name == boneName) return i;
		return -1;
	},
	/** @return May be null. */
	findSlot: function (slotName) {
		var slots = this.slots;
		for (var i = 0, n = slots.length; i < n; i++)
			if (slots[i].data.name == slotName) return slots[i];
		return null;
	},
	/** @return -1 if the bone was not found. */
	findSlotIndex: function (slotName) {
		var slots = this.slots;
		for (var i = 0, n = slots.length; i < n; i++)
			if (slots[i].data.name == slotName) return i;
		return -1;
	},
	setSkinByName: function (skinName) {
		var skin = this.data.findSkin(skinName);
		if (!skin) throw "Skin not found: " + skinName;
		this.setSkin(skin);
	},
	/** Sets the skin used to look up attachments before looking in the {@link SkeletonData#getDefaultSkin() default skin}. 
	 * Attachments from the new skin are attached if the corresponding attachment from the old skin was attached. If there was 
	 * no old skin, each slot's setup mode attachment is attached from the new skin.
	 * @param newSkin May be null. */
	setSkin: function (newSkin) {
		if (newSkin) {
			if (this.skin)
				newSkin._attachAll(this, this.skin);
			else {
				var slots = this.slots;
				for (var i = 0, n = slots.length; i < n; i++) {
					var slot = slots[i];
					var name = slot.data.attachmentName;
					if (name) {
						var attachment = newSkin.getAttachment(i, name);
						if (attachment) slot.setAttachment(attachment);
					}
				}
			}
		}
		this.skin = newSkin;
	},
	/** @return May be null. */
	getAttachmentBySlotName: function (slotName, attachmentName) {
		return this.getAttachmentBySlotIndex(this.data.findSlotIndex(slotName), attachmentName);
	},
	/** @return May be null. */
	getAttachmentBySlotIndex: function (slotIndex, attachmentName) {
		if (this.skin) {
			var attachment = this.skin.getAttachment(slotIndex, attachmentName);
			if (attachment) return attachment;
		}
		if (this.data.defaultSkin) return this.data.defaultSkin.getAttachment(slotIndex, attachmentName);
		return null;
	},
	/** @param attachmentName May be null. */
	setAttachment: function (slotName, attachmentName) {
		var slots = this.slots;
		for (var i = 0, n = slots.length; i < n; i++) {
			var slot = slots[i];
			if (slot.data.name == slotName) {
				var attachment = null;
				if (attachmentName) {
					attachment = this.getAttachmentBySlotIndex(i, attachmentName);
					if (!attachment) throw "Attachment not found: " + attachmentName + ", for slot: " + slotName;
				}
				slot.setAttachment(attachment);
				return;
			}
		}
		throw "Slot not found: " + slotName;
	},
	/** @return May be null. */
	findIkConstraint: function (ikConstraintName) {
		var ikConstraints = this.ikConstraints;
		for (var i = 0, n = ikConstraints.length; i < n; i++)
			if (ikConstraints[i].data.name == ikConstraintName) return ikConstraints[i];
		return null;
	},
	update: function (delta) {
		this.time += delta;
	}
};

spine.EventData = function (name) {
	this.name = name;
};
spine.EventData.prototype = {
	intValue: 0,
	floatValue: 0,
	stringValue: null
};

spine.Event = function (data) {
	this.data = data;
};
spine.Event.prototype = {
	intValue: 0,
	floatValue: 0,
	stringValue: null
};

spine.AttachmentType = {
	region: 0,
	boundingbox: 1,
	mesh: 2,
	skinnedmesh: 3
};

spine.RegionAttachment = function (name) {
	this.name = name;
	this.offset = [];
	this.offset.length = 8;
	this.uvs = [];
	this.uvs.length = 8;
};
spine.RegionAttachment.prototype = {
	type: spine.AttachmentType.region,
	x: 0, y: 0,
	rotation: 0,
	scaleX: 1, scaleY: 1,
	width: 0, height: 0,
	r: 1, g: 1, b: 1, a: 1,
	path: null,
	rendererObject: null,
	regionOffsetX: 0, regionOffsetY: 0,
	regionWidth: 0, regionHeight: 0,
	regionOriginalWidth: 0, regionOriginalHeight: 0,
	setUVs: function (u, v, u2, v2, rotate) {
		var uvs = this.uvs;
		if (rotate) {
			uvs[2/*X2*/] = u;
			uvs[3/*Y2*/] = v2;
			uvs[4/*X3*/] = u;
			uvs[5/*Y3*/] = v;
			uvs[6/*X4*/] = u2;
			uvs[7/*Y4*/] = v;
			uvs[0/*X1*/] = u2;
			uvs[1/*Y1*/] = v2;
		} else {
			uvs[0/*X1*/] = u;
			uvs[1/*Y1*/] = v2;
			uvs[2/*X2*/] = u;
			uvs[3/*Y2*/] = v;
			uvs[4/*X3*/] = u2;
			uvs[5/*Y3*/] = v;
			uvs[6/*X4*/] = u2;
			uvs[7/*Y4*/] = v2;
		}
	},
	updateOffset: function () {
		var regionScaleX = this.width / this.regionOriginalWidth * this.scaleX;
		var regionScaleY = this.height / this.regionOriginalHeight * this.scaleY;
		var localX = -this.width / 2 * this.scaleX + this.regionOffsetX * regionScaleX;
		var localY = -this.height / 2 * this.scaleY + this.regionOffsetY * regionScaleY;
		var localX2 = localX + this.regionWidth * regionScaleX;
		var localY2 = localY + this.regionHeight * regionScaleY;
		var radians = this.rotation * spine.degRad;
		var cos = Math.cos(radians);
		var sin = Math.sin(radians);
		var localXCos = localX * cos + this.x;
		var localXSin = localX * sin;
		var localYCos = localY * cos + this.y;
		var localYSin = localY * sin;
		var localX2Cos = localX2 * cos + this.x;
		var localX2Sin = localX2 * sin;
		var localY2Cos = localY2 * cos + this.y;
		var localY2Sin = localY2 * sin;
		var offset = this.offset;
		offset[0/*X1*/] = localXCos - localYSin;
		offset[1/*Y1*/] = localYCos + localXSin;
		offset[2/*X2*/] = localXCos - localY2Sin;
		offset[3/*Y2*/] = localY2Cos + localXSin;
		offset[4/*X3*/] = localX2Cos - localY2Sin;
		offset[5/*Y3*/] = localY2Cos + localX2Sin;
		offset[6/*X4*/] = localX2Cos - localYSin;
		offset[7/*Y4*/] = localYCos + localX2Sin;
	},
	computeVertices: function (x, y, bone, vertices) {
		x += bone.worldX;
		y += bone.worldY;
		var m00 = bone.m00, m01 = bone.m01, m10 = bone.m10, m11 = bone.m11;
		var offset = this.offset;
		vertices[0/*X1*/] = offset[0/*X1*/] * m00 + offset[1/*Y1*/] * m01 + x;
		vertices[1/*Y1*/] = offset[0/*X1*/] * m10 + offset[1/*Y1*/] * m11 + y;
		vertices[2/*X2*/] = offset[2/*X2*/] * m00 + offset[3/*Y2*/] * m01 + x;
		vertices[3/*Y2*/] = offset[2/*X2*/] * m10 + offset[3/*Y2*/] * m11 + y;
		vertices[4/*X3*/] = offset[4/*X3*/] * m00 + offset[5/*X3*/] * m01 + x;
		vertices[5/*X3*/] = offset[4/*X3*/] * m10 + offset[5/*X3*/] * m11 + y;
		vertices[6/*X4*/] = offset[6/*X4*/] * m00 + offset[7/*Y4*/] * m01 + x;
		vertices[7/*Y4*/] = offset[6/*X4*/] * m10 + offset[7/*Y4*/] * m11 + y;
	}
};

spine.MeshAttachment = function (name) {
	this.name = name;
};
spine.MeshAttachment.prototype = {
	type: spine.AttachmentType.mesh,
	vertices: null,
	uvs: null,
	regionUVs: null,
	triangles: null,
	hullLength: 0,
	r: 1, g: 1, b: 1, a: 1,
	path: null,
	rendererObject: null,
	regionU: 0, regionV: 0, regionU2: 0, regionV2: 0, regionRotate: false,
	regionOffsetX: 0, regionOffsetY: 0,
	regionWidth: 0, regionHeight: 0,
	regionOriginalWidth: 0, regionOriginalHeight: 0,
	edges: null,
	width: 0, height: 0,
	updateUVs: function () {
		var width = this.regionU2 - this.regionU, height = this.regionV2 - this.regionV;
		var n = this.regionUVs.length;
		if (!this.uvs || this.uvs.length != n) {
            this.uvs = new spine.Float32Array(n);
		}
		if (this.regionRotate) {
			for (var i = 0; i < n; i += 2) {
                this.uvs[i] = this.regionU + this.regionUVs[i + 1] * width;
                this.uvs[i + 1] = this.regionV + height - this.regionUVs[i] * height;
			}
		} else {
			for (var i = 0; i < n; i += 2) {
                this.uvs[i] = this.regionU + this.regionUVs[i] * width;
                this.uvs[i + 1] = this.regionV + this.regionUVs[i + 1] * height;
			}
		}
	},
	computeWorldVertices: function (x, y, slot, worldVertices) {
		var bone = slot.bone;
		x += bone.worldX;
		y += bone.worldY;
		var m00 = bone.m00, m01 = bone.m01, m10 = bone.m10, m11 = bone.m11;
		var vertices = this.vertices;
		var verticesCount = vertices.length;
		if (slot.attachmentVertices.length == verticesCount) vertices = slot.attachmentVertices;
		for (var i = 0; i < verticesCount; i += 2) {
			var vx = vertices[i];
			var vy = vertices[i + 1];
			worldVertices[i] = vx * m00 + vy * m01 + x;
			worldVertices[i + 1] = vx * m10 + vy * m11 + y;
		}
	}
};

spine.SkinnedMeshAttachment = function (name) {
	this.name = name;
};
spine.SkinnedMeshAttachment.prototype = {
	type: spine.AttachmentType.skinnedmesh,
	bones: null,
	weights: null,
	uvs: null,
	regionUVs: null,
	triangles: null,
	hullLength: 0,
	r: 1, g: 1, b: 1, a: 1,
	path: null,
	rendererObject: null,
	regionU: 0, regionV: 0, regionU2: 0, regionV2: 0, regionRotate: false,
	regionOffsetX: 0, regionOffsetY: 0,
	regionWidth: 0, regionHeight: 0,
	regionOriginalWidth: 0, regionOriginalHeight: 0,
	edges: null,
	width: 0, height: 0,
	updateUVs: function (u, v, u2, v2, rotate) {
		var width = this.regionU2 - this.regionU, height = this.regionV2 - this.regionV;
		var n = this.regionUVs.length;
		if (!this.uvs || this.uvs.length != n) {
            this.uvs = new spine.Float32Array(n);
		}
		if (this.regionRotate) {
			for (var i = 0; i < n; i += 2) {
                this.uvs[i] = this.regionU + this.regionUVs[i + 1] * width;
                this.uvs[i + 1] = this.regionV + height - this.regionUVs[i] * height;
			}
		} else {
			for (var i = 0; i < n; i += 2) {
                this.uvs[i] = this.regionU + this.regionUVs[i] * width;
                this.uvs[i + 1] = this.regionV + this.regionUVs[i + 1] * height;
			}
		}
	},
	computeWorldVertices: function (x, y, slot, worldVertices) {
		var skeletonBones = slot.bone.skeleton.bones;
		var weights = this.weights;
		var bones = this.bones;

		var w = 0, v = 0, b = 0, f = 0, n = bones.length, nn;
		var wx, wy, bone, vx, vy, weight;
		if (!slot.attachmentVertices.length) {
			for (; v < n; w += 2) {
				wx = 0;
				wy = 0;
				nn = bones[v++] + v;
				for (; v < nn; v++, b += 3) {
					bone = skeletonBones[bones[v]];
					vx = weights[b];
					vy = weights[b + 1];
					weight = weights[b + 2];
					wx += (vx * bone.m00 + vy * bone.m01 + bone.worldX) * weight;
					wy += (vx * bone.m10 + vy * bone.m11 + bone.worldY) * weight;
				}
				worldVertices[w] = wx + x;
				worldVertices[w + 1] = wy + y;
			}
		} else {
			var ffd = slot.attachmentVertices;
			for (; v < n; w += 2) {
				wx = 0;
				wy = 0;
				nn = bones[v++] + v;
				for (; v < nn; v++, b += 3, f += 2) {
					bone = skeletonBones[bones[v]];
					vx = weights[b] + ffd[f];
					vy = weights[b + 1] + ffd[f + 1];
					weight = weights[b + 2];
					wx += (vx * bone.m00 + vy * bone.m01 + bone.worldX) * weight;
					wy += (vx * bone.m10 + vy * bone.m11 + bone.worldY) * weight;
				}
				worldVertices[w] = wx + x;
				worldVertices[w + 1] = wy + y;
			}
		}
	}
};

spine.BoundingBoxAttachment = function (name) {
	this.name = name;
	this.vertices = [];
};
spine.BoundingBoxAttachment.prototype = {
	type: spine.AttachmentType.boundingbox,
	computeWorldVertices: function (x, y, bone, worldVertices) {
		x += bone.worldX;
		y += bone.worldY;
		var m00 = bone.m00, m01 = bone.m01, m10 = bone.m10, m11 = bone.m11;
		var vertices = this.vertices;
		for (var i = 0, n = vertices.length; i < n; i += 2) {
			var px = vertices[i];
			var py = vertices[i + 1];
			worldVertices[i] = px * m00 + py * m01 + x;
			worldVertices[i + 1] = px * m10 + py * m11 + y;
		}
	}
};

spine.AnimationStateData = function (skeletonData) {
	this.skeletonData = skeletonData;
	this.animationToMixTime = {};
};
spine.AnimationStateData.prototype = {
	defaultMix: 0,
	setMixByName: function (fromName, toName, duration) {
		var from = this.skeletonData.findAnimation(fromName);
		if (!from) throw "Animation not found: " + fromName;
		var to = this.skeletonData.findAnimation(toName);
		if (!to) throw "Animation not found: " + toName;
		this.setMix(from, to, duration);
	},
	setMix: function (from, to, duration) {
		this.animationToMixTime[from.name + ":" + to.name] = duration;
	},
	getMix: function (from, to) {
		var key = from.name + ":" + to.name;
		return this.animationToMixTime.hasOwnProperty(key) ? this.animationToMixTime[key] : this.defaultMix;
	}
};

spine.TrackEntry = function () {};
spine.TrackEntry.prototype = {
	next: null, previous: null,
	animation: null,
	loop: false,
	delay: 0, time: 0, lastTime: -1, endTime: 0,
	timeScale: 1,
	mixTime: 0, mixDuration: 0, mix: 1,
	onStart: null, onEnd: null, onComplete: null, onEvent: null
};

spine.AnimationState = function (stateData) {
	this.data = stateData;
	this.tracks = [];
	this.events = [];
};
spine.AnimationState.prototype = {
	onStart: null,
	onEnd: null,
	onComplete: null,
	onEvent: null,
	timeScale: 1,
	update: function (delta) {
		delta *= this.timeScale;
		for (var i = 0; i < this.tracks.length; i++) {
			var current = this.tracks[i];
			if (!current) continue;

			current.time += delta * current.timeScale;
			if (current.previous) {
				var previousDelta = delta * current.previous.timeScale;
				current.previous.time += previousDelta;
				current.mixTime += previousDelta;
			}

			var next = current.next;
			if (next) {
				next.time = current.lastTime - next.delay;
				if (next.time >= 0) this.setCurrent(i, next);
			} else {
				// End non-looping animation when it reaches its end time and there is no next entry.
				if (!current.loop && current.lastTime >= current.endTime) this.clearTrack(i);
			}
		}
	},
	apply: function (skeleton) {
		for (var i = 0; i < this.tracks.length; i++) {
			var current = this.tracks[i];
			if (!current) continue;

			this.events.length = 0;

			var time = current.time;
			var lastTime = current.lastTime;
			var endTime = current.endTime;
			var loop = current.loop;
			if (!loop && time > endTime) time = endTime;

			var previous = current.previous;
			if (!previous) {
				if (current.mix == 1)
					current.animation.apply(skeleton, current.lastTime, time, loop, this.events);
				else
					current.animation.mix(skeleton, current.lastTime, time, loop, this.events, current.mix);
			} else {
				var previousTime = previous.time;
				if (!previous.loop && previousTime > previous.endTime) previousTime = previous.endTime;
				previous.animation.apply(skeleton, previousTime, previousTime, previous.loop, null);

				var alpha = current.mixTime / current.mixDuration * current.mix;
				if (alpha >= 1) {
					alpha = 1;
					current.previous = null;
				}
				current.animation.mix(skeleton, current.lastTime, time, loop, this.events, alpha);
			}

			for (var ii = 0, nn = this.events.length; ii < nn; ii++) {
				var event = this.events[ii];
				if (current.onEvent) current.onEvent(i, event);
				if (this.onEvent) this.onEvent(i, event);
			}

			// Check if completed the animation or a loop iteration.
			if (loop ? (lastTime % endTime > time % endTime) : (lastTime < endTime && time >= endTime)) {
				var count = Math.floor(time / endTime);
				if (current.onComplete) current.onComplete(i, count);
				if (this.onComplete) this.onComplete(i, count);
			}

			current.lastTime = current.time;
		}
	},
	clearTracks: function () {
		for (var i = 0, n = this.tracks.length; i < n; i++)
			this.clearTrack(i);
		this.tracks.length = 0; 
	},
	clearTrack: function (trackIndex) {
		if (trackIndex >= this.tracks.length) return;
		var current = this.tracks[trackIndex];
		if (!current) return;

		if (current.onEnd) current.onEnd(trackIndex);
		if (this.onEnd) this.onEnd(trackIndex);

		this.tracks[trackIndex] = null;
	},
	_expandToIndex: function (index) {
		if (index < this.tracks.length) return this.tracks[index];
		while (index >= this.tracks.length)
			this.tracks.push(null);
		return null;
	},
	setCurrent: function (index, entry) {
		var current = this._expandToIndex(index);
		if (current) {
			var previous = current.previous;
			current.previous = null;

			if (current.onEnd) current.onEnd(index);
			if (this.onEnd) this.onEnd(index);

			entry.mixDuration = this.data.getMix(current.animation, entry.animation);
			if (entry.mixDuration > 0) {
				entry.mixTime = 0;
				// If a mix is in progress, mix from the closest animation.
				if (previous && current.mixTime / current.mixDuration < 0.5)
					entry.previous = previous;
				else
					entry.previous = current;
			}
		}

		this.tracks[index] = entry;

		if (entry.onStart) entry.onStart(index);
		if (this.onStart) this.onStart(index);
	},
	setAnimationByName: function (trackIndex, animationName, loop) {
		var animation = this.data.skeletonData.findAnimation(animationName);
		if (!animation) throw "Animation not found: " + animationName;
		return this.setAnimation(trackIndex, animation, loop);
	},
	/** Set the current animation. Any queued animations are cleared. */
	setAnimation: function (trackIndex, animation, loop) {
		var entry = new spine.TrackEntry();
		entry.animation = animation;
		entry.loop = loop;
		entry.endTime = animation.duration;
		this.setCurrent(trackIndex, entry);
		return entry;
	},
	addAnimationByName: function (trackIndex, animationName, loop, delay) {
		var animation = this.data.skeletonData.findAnimation(animationName);
		if (!animation) throw "Animation not found: " + animationName;
		return this.addAnimation(trackIndex, animation, loop, delay);
	},
	/** Adds an animation to be played delay seconds after the current or last queued animation.
	 * @param delay May be <= 0 to use duration of previous animation minus any mix duration plus the negative delay. */
	addAnimation: function (trackIndex, animation, loop, delay) {
		var entry = new spine.TrackEntry();
		entry.animation = animation;
		entry.loop = loop;
		entry.endTime = animation.duration;

		var last = this._expandToIndex(trackIndex);
		if (last) {
			while (last.next)
				last = last.next;
			last.next = entry;
		} else
			this.tracks[trackIndex] = entry;

		if (delay <= 0) {
			if (last)
				delay += last.endTime - this.data.getMix(last.animation, animation);
			else
				delay = 0;
		}
		entry.delay = delay;

		return entry;
	},
	/** May be null. */
	getCurrent: function (trackIndex) {
		if (trackIndex >= this.tracks.length) return null;
		return this.tracks[trackIndex];
	}
};

spine.SkeletonJson = function (attachmentLoader) {
	this.attachmentLoader = attachmentLoader;
};
spine.SkeletonJson.prototype = {
	scale: 1,
	readSkeletonData: function (root, name) {
		var skeletonData = new spine.SkeletonData();
		skeletonData.name = name;

		// Skeleton.
		var skeletonMap = root["skeleton"];
		if (skeletonMap) {
			skeletonData.hash = skeletonMap["hash"];
			skeletonData.version = skeletonMap["spine"];
			skeletonData.width = skeletonMap["width"] || 0;
			skeletonData.height = skeletonMap["height"] || 0;
		}

		// Bones.
		var bones = root["bones"];
		for (var i = 0, n = bones.length; i < n; i++) {
			var boneMap = bones[i];
			var parent = null;
			if (boneMap["parent"]) {
				parent = skeletonData.findBone(boneMap["parent"]);
				if (!parent) throw "Parent bone not found: " + boneMap["parent"];
			}
			var boneData = new spine.BoneData(boneMap["name"], parent);
			boneData.length = (boneMap["length"] || 0) * this.scale;
			boneData.x = (boneMap["x"] || 0) * this.scale;
			boneData.y = (boneMap["y"] || 0) * this.scale;
			boneData.rotation = (boneMap["rotation"] || 0);
			boneData.scaleX = boneMap.hasOwnProperty("scaleX") ? boneMap["scaleX"] : 1;
			boneData.scaleY = boneMap.hasOwnProperty("scaleY") ? boneMap["scaleY"] : 1;
			boneData.inheritScale = boneMap.hasOwnProperty("inheritScale") ? boneMap["inheritScale"] : true;
			boneData.inheritRotation = boneMap.hasOwnProperty("inheritRotation") ? boneMap["inheritRotation"] : true;
			skeletonData.bones.push(boneData);
		}

		// IK constraints.
		var ik = root["ik"];
		if (ik) {
			for (var i = 0, n = ik.length; i < n; i++) {
				var ikMap = ik[i];
				var ikConstraintData = new spine.IkConstraintData(ikMap["name"]);

				var bones = ikMap["bones"];
				for (var ii = 0, nn = bones.length; ii < nn; ii++) {
					var bone = skeletonData.findBone(bones[ii]);
					if (!bone) throw "IK bone not found: " + bones[ii];
					ikConstraintData.bones.push(bone);
				}

				ikConstraintData.target = skeletonData.findBone(ikMap["target"]);
				if (!ikConstraintData.target) throw "Target bone not found: " + ikMap["target"];

				ikConstraintData.bendDirection = (!ikMap.hasOwnProperty("bendPositive") || ikMap["bendPositive"]) ? 1 : -1;
				ikConstraintData.mix = ikMap.hasOwnProperty("mix") ? ikMap["mix"] : 1;

				skeletonData.ikConstraints.push(ikConstraintData);
			}
		}

		// Slots.
		var slots = root["slots"];
		for (var i = 0, n = slots.length; i < n; i++) {
			var slotMap = slots[i];
			var boneData = skeletonData.findBone(slotMap["bone"]);
			if (!boneData) throw "Slot bone not found: " + slotMap["bone"];
			var slotData = new spine.SlotData(slotMap["name"], boneData);

			var color = slotMap["color"];
			if (color) {
				slotData.r = this.toColor(color, 0);
				slotData.g = this.toColor(color, 1);
				slotData.b = this.toColor(color, 2);
				slotData.a = this.toColor(color, 3);
			}

			slotData.attachmentName = slotMap["attachment"];
			slotData.blendMode = spine.BlendMode[slotMap["blend"] || "normal"];

			skeletonData.slots.push(slotData);
		}

		// Skins.
		var skins = root["skins"];
		for (var skinName in skins) {
			if (!skins.hasOwnProperty(skinName)) continue;
			var skinMap = skins[skinName];
			var skin = new spine.Skin(skinName);
			for (var slotName in skinMap) {
				if (!skinMap.hasOwnProperty(slotName)) continue;
				var slotIndex = skeletonData.findSlotIndex(slotName);
				var slotEntry = skinMap[slotName];
				for (var attachmentName in slotEntry) {
					if (!slotEntry.hasOwnProperty(attachmentName)) continue;
					var attachment = this.readAttachment(skin, attachmentName, slotEntry[attachmentName]);
					if (attachment) skin.addAttachment(slotIndex, attachmentName, attachment);
				}
			}
			skeletonData.skins.push(skin);
			if (skin.name == "default") skeletonData.defaultSkin = skin;
		}

		// Events.
		var events = root["events"];
		for (var eventName in events) {
			if (!events.hasOwnProperty(eventName)) continue;
			var eventMap = events[eventName];
			var eventData = new spine.EventData(eventName);
			eventData.intValue = eventMap["int"] || 0;
			eventData.floatValue = eventMap["float"] || 0;
			eventData.stringValue = eventMap["string"] || null;
			skeletonData.events.push(eventData);
		}

		// Animations.
		var animations = root["animations"];
		for (var animationName in animations) {
			if (!animations.hasOwnProperty(animationName)) continue;
			this.readAnimation(animationName, animations[animationName], skeletonData);
		}

		return skeletonData;
	},
	readAttachment: function (skin, name, map) {
		name = map["name"] || name;

		var type = spine.AttachmentType[map["type"] || "region"];
		var path = map["path"] || name;
		
		var scale = this.scale;
		if (type == spine.AttachmentType.region) {
			var region = this.attachmentLoader.newRegionAttachment(skin, name, path);
			if (!region) return null;
			region.path = path;
			region.x = (map["x"] || 0) * scale;
			region.y = (map["y"] || 0) * scale;
			region.scaleX = map.hasOwnProperty("scaleX") ? map["scaleX"] : 1;
			region.scaleY = map.hasOwnProperty("scaleY") ? map["scaleY"] : 1;
			region.rotation = map["rotation"] || 0;
			region.width = (map["width"] || 0) * scale;
			region.height = (map["height"] || 0) * scale;

			var color = map["color"];
			if (color) {
				region.r = this.toColor(color, 0);
				region.g = this.toColor(color, 1);
				region.b = this.toColor(color, 2);
				region.a = this.toColor(color, 3);
			}

			region.updateOffset();
			return region;
		} else if (type == spine.AttachmentType.mesh) {
			var mesh = this.attachmentLoader.newMeshAttachment(skin, name, path);
			if (!mesh) return null;
			mesh.path = path; 
			mesh.vertices = this.getFloatArray(map, "vertices", scale);
			mesh.triangles = this.getIntArray(map, "triangles");
			mesh.regionUVs = this.getFloatArray(map, "uvs", 1);
			mesh.updateUVs();

			color = map["color"];
			if (color) {
				mesh.r = this.toColor(color, 0);
				mesh.g = this.toColor(color, 1);
				mesh.b = this.toColor(color, 2);
				mesh.a = this.toColor(color, 3);
			}

			mesh.hullLength = (map["hull"] || 0) * 2;
			if (map["edges"]) mesh.edges = this.getIntArray(map, "edges");
			mesh.width = (map["width"] || 0) * scale;
			mesh.height = (map["height"] || 0) * scale;
			return mesh;
		} else if (type == spine.AttachmentType.skinnedmesh) {
			var mesh = this.attachmentLoader.newSkinnedMeshAttachment(skin, name, path);
			if (!mesh) return null;
			mesh.path = path;

			var uvs = this.getFloatArray(map, "uvs", 1);
			var vertices = this.getFloatArray(map, "vertices", 1);
			var weights = [];
			var bones = [];
			for (var i = 0, n = vertices.length; i < n; ) {
				var boneCount = vertices[i++] | 0;
				bones[bones.length] = boneCount;
				for (var nn = i + boneCount * 4; i < nn; ) {
					bones[bones.length] = vertices[i];
					weights[weights.length] = vertices[i + 1] * scale;
					weights[weights.length] = vertices[i + 2] * scale;
					weights[weights.length] = vertices[i + 3];
					i += 4;
				}
			}
			mesh.bones = bones;
			mesh.weights = weights;
			mesh.triangles = this.getIntArray(map, "triangles");
			mesh.regionUVs = uvs;
			mesh.updateUVs();
			
			color = map["color"];
			if (color) {
				mesh.r = this.toColor(color, 0);
				mesh.g = this.toColor(color, 1);
				mesh.b = this.toColor(color, 2);
				mesh.a = this.toColor(color, 3);
			}
			
			mesh.hullLength = (map["hull"] || 0) * 2;
			if (map["edges"]) mesh.edges = this.getIntArray(map, "edges");
			mesh.width = (map["width"] || 0) * scale;
			mesh.height = (map["height"] || 0) * scale;
			return mesh;
		} else if (type == spine.AttachmentType.boundingbox) {
			var attachment = this.attachmentLoader.newBoundingBoxAttachment(skin, name);
			var vertices = map["vertices"];
			for (var i = 0, n = vertices.length; i < n; i++)
				attachment.vertices.push(vertices[i] * scale);
			return attachment;
		}
		throw "Unknown attachment type: " + type;
	},
	readAnimation: function (name, map, skeletonData) {
		var timelines = [];
		var duration = 0;

		var slots = map["slots"];
		for (var slotName in slots) {
			if (!slots.hasOwnProperty(slotName)) continue;
			var slotMap = slots[slotName];
			var slotIndex = skeletonData.findSlotIndex(slotName);

			for (var timelineName in slotMap) {
				if (!slotMap.hasOwnProperty(timelineName)) continue;
				var values = slotMap[timelineName];
				if (timelineName == "color") {
					var timeline = new spine.ColorTimeline(values.length);
					timeline.slotIndex = slotIndex;

					var frameIndex = 0;
					for (var i = 0, n = values.length; i < n; i++) {
						var valueMap = values[i];
						var color = valueMap["color"];
						var r = this.toColor(color, 0);
						var g = this.toColor(color, 1);
						var b = this.toColor(color, 2);
						var a = this.toColor(color, 3);
						timeline.setFrame(frameIndex, valueMap["time"], r, g, b, a);
						this.readCurve(timeline, frameIndex, valueMap);
						frameIndex++;
					}
					timelines.push(timeline);
					duration = Math.max(duration, timeline.frames[timeline.getFrameCount() * 5 - 5]);

				} else if (timelineName == "attachment") {
					var timeline = new spine.AttachmentTimeline(values.length);
					timeline.slotIndex = slotIndex;

					var frameIndex = 0;
					for (var i = 0, n = values.length; i < n; i++) {
						var valueMap = values[i];
						timeline.setFrame(frameIndex++, valueMap["time"], valueMap["name"]);
					}
					timelines.push(timeline);
					duration = Math.max(duration, timeline.frames[timeline.getFrameCount() - 1]);

				} else
					throw "Invalid timeline type for a slot: " + timelineName + " (" + slotName + ")";
			}
		}

		var bones = map["bones"];
		for (var boneName in bones) {
			if (!bones.hasOwnProperty(boneName)) continue;
			var boneIndex = skeletonData.findBoneIndex(boneName);
			if (boneIndex == -1) throw "Bone not found: " + boneName;
			var boneMap = bones[boneName];

			for (var timelineName in boneMap) {
				if (!boneMap.hasOwnProperty(timelineName)) continue;
				var values = boneMap[timelineName];
				if (timelineName == "rotate") {
					var timeline = new spine.RotateTimeline(values.length);
					timeline.boneIndex = boneIndex;

					var frameIndex = 0;
					for (var i = 0, n = values.length; i < n; i++) {
						var valueMap = values[i];
						timeline.setFrame(frameIndex, valueMap["time"], valueMap["angle"]);
						this.readCurve(timeline, frameIndex, valueMap);
						frameIndex++;
					}
					timelines.push(timeline);
					duration = Math.max(duration, timeline.frames[timeline.getFrameCount() * 2 - 2]);

				} else if (timelineName == "translate" || timelineName == "scale") {
					var timeline;
					var timelineScale = 1;
					if (timelineName == "scale")
						timeline = new spine.ScaleTimeline(values.length);
					else {
						timeline = new spine.TranslateTimeline(values.length);
						timelineScale = this.scale;
					}
					timeline.boneIndex = boneIndex;

					var frameIndex = 0;
					for (var i = 0, n = values.length; i < n; i++) {
						var valueMap = values[i];
						var x = (valueMap["x"] || 0) * timelineScale;
						var y = (valueMap["y"] || 0) * timelineScale;
						timeline.setFrame(frameIndex, valueMap["time"], x, y);
						this.readCurve(timeline, frameIndex, valueMap);
						frameIndex++;
					}
					timelines.push(timeline);
					duration = Math.max(duration, timeline.frames[timeline.getFrameCount() * 3 - 3]);

				} else if (timelineName == "flipX" || timelineName == "flipY") {
					var x = timelineName == "flipX";
					var timeline = x ? new spine.FlipXTimeline(values.length) : new spine.FlipYTimeline(values.length);
					timeline.boneIndex = boneIndex;

					var field = x ? "x" : "y";
					var frameIndex = 0;
					for (var i = 0, n = values.length; i < n; i++) {
						var valueMap = values[i];
						timeline.setFrame(frameIndex, valueMap["time"], valueMap[field] || false);
						frameIndex++;
					}
					timelines.push(timeline);
					duration = Math.max(duration, timeline.frames[timeline.getFrameCount() * 2 - 2]);
				} else
					throw "Invalid timeline type for a bone: " + timelineName + " (" + boneName + ")";
			}
		}

		var ikMap = map["ik"];
		for (var ikConstraintName in ikMap) {
			if (!ikMap.hasOwnProperty(ikConstraintName)) continue;
			var ikConstraint = skeletonData.findIkConstraint(ikConstraintName);
			var values = ikMap[ikConstraintName];
			var timeline = new spine.IkConstraintTimeline(values.length);
			timeline.ikConstraintIndex = skeletonData.ikConstraints.indexOf(ikConstraint);
			var frameIndex = 0;
			for (var i = 0, n = values.length; i < n; i++) {
				var valueMap = values[i];
				var mix = valueMap.hasOwnProperty("mix") ? valueMap["mix"] : 1;
				var bendDirection = (!valueMap.hasOwnProperty("bendPositive") || valueMap["bendPositive"]) ? 1 : -1;
				timeline.setFrame(frameIndex, valueMap["time"], mix, bendDirection);
				this.readCurve(timeline, frameIndex, valueMap);
				frameIndex++;
			}
			timelines.push(timeline);
			duration = Math.max(duration, timeline.frames[timeline.frameCount * 3 - 3]);
		}

		var ffd = map["ffd"];
		for (var skinName in ffd) {
			var skin = skeletonData.findSkin(skinName);
			var slotMap = ffd[skinName];
			for (slotName in slotMap) {
				var slotIndex = skeletonData.findSlotIndex(slotName);
				var meshMap = slotMap[slotName];
				for (var meshName in meshMap) {
					var values = meshMap[meshName];
					var timeline = new spine.FfdTimeline(values.length);
					var attachment = skin.getAttachment(slotIndex, meshName);
					if (!attachment) throw "FFD attachment not found: " + meshName;
					timeline.slotIndex = slotIndex;
					timeline.attachment = attachment;
					
					var isMesh = attachment.type == spine.AttachmentType.mesh;
					var vertexCount;
					if (isMesh)
						vertexCount = attachment.vertices.length;
					else
						vertexCount = attachment.weights.length / 3 * 2;

					var frameIndex = 0;
					for (var i = 0, n = values.length; i < n; i++) {
						var valueMap = values[i];
						var vertices;
						if (!valueMap["vertices"]) {
							if (isMesh)
								vertices = attachment.vertices;
							else {
								vertices = [];
								vertices.length = vertexCount;
							}
						} else {
							var verticesValue = valueMap["vertices"];
							var vertices = [];
							vertices.length = vertexCount;
							var start = valueMap["offset"] || 0;
							var nn = verticesValue.length;
							if (this.scale == 1) {
								for (var ii = 0; ii < nn; ii++)
									vertices[ii + start] = verticesValue[ii];
							} else {
								for (var ii = 0; ii < nn; ii++)
									vertices[ii + start] = verticesValue[ii] * this.scale;
							}
							if (isMesh) {
								var meshVertices = attachment.vertices;
								for (var ii = 0, nn = vertices.length; ii < nn; ii++)
									vertices[ii] += meshVertices[ii];
							}
						}
						
						timeline.setFrame(frameIndex, valueMap["time"], vertices);
						this.readCurve(timeline, frameIndex, valueMap);
						frameIndex++;
					}
					timelines[timelines.length] = timeline;
					duration = Math.max(duration, timeline.frames[timeline.frameCount - 1]);
				}
			}
		}

		var drawOrderValues = map["drawOrder"];
		if (!drawOrderValues) drawOrderValues = map["draworder"];
		if (drawOrderValues) {
			var timeline = new spine.DrawOrderTimeline(drawOrderValues.length);
			var slotCount = skeletonData.slots.length;
			var frameIndex = 0;
			for (var i = 0, n = drawOrderValues.length; i < n; i++) {
				var drawOrderMap = drawOrderValues[i];
				var drawOrder = null;
				if (drawOrderMap["offsets"]) {
					drawOrder = [];
					drawOrder.length = slotCount;
					for (var ii = slotCount - 1; ii >= 0; ii--)
						drawOrder[ii] = -1;
					var offsets = drawOrderMap["offsets"];
					var unchanged = [];
					unchanged.length = slotCount - offsets.length;
					var originalIndex = 0, unchangedIndex = 0;
					for (var ii = 0, nn = offsets.length; ii < nn; ii++) {
						var offsetMap = offsets[ii];
						var slotIndex = skeletonData.findSlotIndex(offsetMap["slot"]);
						if (slotIndex == -1) throw "Slot not found: " + offsetMap["slot"];
						// Collect unchanged items.
						while (originalIndex != slotIndex)
							unchanged[unchangedIndex++] = originalIndex++;
						// Set changed items.
						drawOrder[originalIndex + offsetMap["offset"]] = originalIndex++;
					}
					// Collect remaining unchanged items.
					while (originalIndex < slotCount)
						unchanged[unchangedIndex++] = originalIndex++;
					// Fill in unchanged items.
					for (var ii = slotCount - 1; ii >= 0; ii--)
						if (drawOrder[ii] == -1) drawOrder[ii] = unchanged[--unchangedIndex];
				}
				timeline.setFrame(frameIndex++, drawOrderMap["time"], drawOrder);
			}
			timelines.push(timeline);
			duration = Math.max(duration, timeline.frames[timeline.getFrameCount() - 1]);
		}

		var events = map["events"];
		if (events) {
			var timeline = new spine.EventTimeline(events.length);
			var frameIndex = 0;
			for (var i = 0, n = events.length; i < n; i++) {
				var eventMap = events[i];
				var eventData = skeletonData.findEvent(eventMap["name"]);
				if (!eventData) throw "Event not found: " + eventMap["name"];
				var event = new spine.Event(eventData);
				event.intValue = eventMap.hasOwnProperty("int") ? eventMap["int"] : eventData.intValue;
				event.floatValue = eventMap.hasOwnProperty("float") ? eventMap["float"] : eventData.floatValue;
				event.stringValue = eventMap.hasOwnProperty("string") ? eventMap["string"] : eventData.stringValue;
				timeline.setFrame(frameIndex++, eventMap["time"], event);
			}
			timelines.push(timeline);
			duration = Math.max(duration, timeline.frames[timeline.getFrameCount() - 1]);
		}

		skeletonData.animations.push(new spine.Animation(name, timelines, duration));
	},
	readCurve: function (timeline, frameIndex, valueMap) {
		var curve = valueMap["curve"];
		if (!curve) 
			timeline.curves.setLinear(frameIndex);
		else if (curve == "stepped")
			timeline.curves.setStepped(frameIndex);
		else if (curve instanceof Array)
			timeline.curves.setCurve(frameIndex, curve[0], curve[1], curve[2], curve[3]);
	},
	toColor: function (hexString, colorIndex) {
		if (hexString.length != 8) throw "Color hexidecimal length must be 8, recieved: " + hexString;
		return parseInt(hexString.substring(colorIndex * 2, (colorIndex * 2) + 2), 16) / 255;
	},
	getFloatArray: function (map, name, scale) {
		var list = map[name];
		var values = new spine.Float32Array(list.length);
		var i = 0, n = list.length;
		if (scale == 1) {
			for (; i < n; i++)
				values[i] = list[i];
		} else {
			for (; i < n; i++)
				values[i] = list[i] * scale;
		}
		return values;
	},
	getIntArray: function (map, name) {
		var list = map[name];
		var values = new spine.Uint16Array(list.length);
		for (var i = 0, n = list.length; i < n; i++)
			values[i] = list[i] | 0;
		return values;
	}
};

spine.Atlas = function (atlasText, textureLoader) {
	this.textureLoader = textureLoader;
	this.pages = [];
	this.regions = [];

	var reader = new spine.AtlasReader(atlasText);
	var tuple = [];
	tuple.length = 4;
	var page = null;
	while (true) {
		var line = reader.readLine();
		if (line === null) break;
		line = reader.trim(line);
		if (!line.length)
			page = null;
		else if (!page) {
			page = new spine.AtlasPage();
			page.name = line;

			if (reader.readTuple(tuple) == 2) { // size is only optional for an atlas packed with an old TexturePacker.
				page.width = parseInt(tuple[0]);
				page.height = parseInt(tuple[1]);
				reader.readTuple(tuple);
			}
			page.format = spine.Atlas.Format[tuple[0]];

			reader.readTuple(tuple);
			page.minFilter = spine.Atlas.TextureFilter[tuple[0]];
			page.magFilter = spine.Atlas.TextureFilter[tuple[1]];

			var direction = reader.readValue();
			page.uWrap = spine.Atlas.TextureWrap.clampToEdge;
			page.vWrap = spine.Atlas.TextureWrap.clampToEdge;
			if (direction == "x")
				page.uWrap = spine.Atlas.TextureWrap.repeat;
			else if (direction == "y")
				page.vWrap = spine.Atlas.TextureWrap.repeat;
			else if (direction == "xy")
				page.uWrap = page.vWrap = spine.Atlas.TextureWrap.repeat;

			textureLoader.load(page, line, this);

			this.pages.push(page);

		} else {
			var region = new spine.AtlasRegion();
			region.name = line;
			region.page = page;

			region.rotate = reader.readValue() == "true";

			reader.readTuple(tuple);
			var x = parseInt(tuple[0]);
			var y = parseInt(tuple[1]);

			reader.readTuple(tuple);
			var width = parseInt(tuple[0]);
			var height = parseInt(tuple[1]);

			region.u = x / page.width;
			region.v = y / page.height;
			if (region.rotate) {
				region.u2 = (x + height) / page.width;
				region.v2 = (y + width) / page.height;
			} else {
				region.u2 = (x + width) / page.width;
				region.v2 = (y + height) / page.height;
			}
			region.x = x;
			region.y = y;
			region.width = Math.abs(width);
			region.height = Math.abs(height);

			if (reader.readTuple(tuple) == 4) { // split is optional
				region.splits = [parseInt(tuple[0]), parseInt(tuple[1]), parseInt(tuple[2]), parseInt(tuple[3])];

				if (reader.readTuple(tuple) == 4) { // pad is optional, but only present with splits
					region.pads = [parseInt(tuple[0]), parseInt(tuple[1]), parseInt(tuple[2]), parseInt(tuple[3])];

					reader.readTuple(tuple);
				}
			}

			region.originalWidth = parseInt(tuple[0]);
			region.originalHeight = parseInt(tuple[1]);

			reader.readTuple(tuple);
			region.offsetX = parseInt(tuple[0]);
			region.offsetY = parseInt(tuple[1]);

			region.index = parseInt(reader.readValue());

			this.regions.push(region);
		}
	}
};
spine.Atlas.prototype = {
	findRegion: function (name) {
		var regions = this.regions;
		for (var i = 0, n = regions.length; i < n; i++)
			if (regions[i].name == name) return regions[i];
		return null;
	},
	dispose: function () {
		var pages = this.pages;
		for (var i = 0, n = pages.length; i < n; i++)
			this.textureLoader.unload(pages[i].rendererObject);
	},
	updateUVs: function (page) {
		var regions = this.regions;
		for (var i = 0, n = regions.length; i < n; i++) {
			var region = regions[i];
			if (region.page != page) continue;
			region.u = region.x / page.width;
			region.v = region.y / page.height;
			if (region.rotate) {
				region.u2 = (region.x + region.height) / page.width;
				region.v2 = (region.y + region.width) / page.height;
			} else {
				region.u2 = (region.x + region.width) / page.width;
				region.v2 = (region.y + region.height) / page.height;
			}
		}
	}
};

spine.Atlas.Format = {
	alpha: 0,
	intensity: 1,
	luminanceAlpha: 2,
	rgb565: 3,
	rgba4444: 4,
	rgb888: 5,
	rgba8888: 6
};

spine.Atlas.TextureFilter = {
	nearest: 0,
	linear: 1,
	mipMap: 2,
	mipMapNearestNearest: 3,
	mipMapLinearNearest: 4,
	mipMapNearestLinear: 5,
	mipMapLinearLinear: 6
};

spine.Atlas.TextureWrap = {
	mirroredRepeat: 0,
	clampToEdge: 1,
	repeat: 2
};

spine.AtlasPage = function () {};
spine.AtlasPage.prototype = {
	name: null,
	format: null,
	minFilter: null,
	magFilter: null,
	uWrap: null,
	vWrap: null,
	rendererObject: null,
	width: 0,
	height: 0
};

spine.AtlasRegion = function () {};
spine.AtlasRegion.prototype = {
	page: null,
	name: null,
	x: 0, y: 0,
	width: 0, height: 0,
	u: 0, v: 0, u2: 0, v2: 0,
	offsetX: 0, offsetY: 0,
	originalWidth: 0, originalHeight: 0,
	index: 0,
	rotate: false,
	splits: null,
	pads: null
};

spine.AtlasReader = function (text) {
	this.lines = text.split(/\r\n|\r|\n/);
};
spine.AtlasReader.prototype = {
	index: 0,
	trim: function (value) {
		return value.replace(/^\s+|\s+$/g, "");
	},
	readLine: function () {
		if (this.index >= this.lines.length) return null;
		return this.lines[this.index++];
	},
	readValue: function () {
		var line = this.readLine();
		var colon = line.indexOf(":");
		if (colon == -1) throw "Invalid line: " + line;
		return this.trim(line.substring(colon + 1));
	},
	/** Returns the number of tuple values read (1, 2 or 4). */
	readTuple: function (tuple) {
		var line = this.readLine();
		var colon = line.indexOf(":");
		if (colon == -1) throw "Invalid line: " + line;
		var i = 0, lastMatch = colon + 1;
		for (; i < 3; i++) {
			var comma = line.indexOf(",", lastMatch);
			if (comma == -1) break;
			tuple[i] = this.trim(line.substr(lastMatch, comma - lastMatch));
			lastMatch = comma + 1;
		}
		tuple[i] = this.trim(line.substring(lastMatch));
		return i + 1;
	}
};

spine.AtlasAttachmentLoader = function (atlas) {
	this.atlas = atlas;
};
spine.AtlasAttachmentLoader.prototype = {
	newRegionAttachment: function (skin, name, path) {
		var region = this.atlas.findRegion(path);
		if (!region) throw "Region not found in atlas: " + path + " (region attachment: " + name + ")";
		var attachment = new spine.RegionAttachment(name);
		attachment.rendererObject = region;
		attachment.setUVs(region.u, region.v, region.u2, region.v2, region.rotate);
		attachment.regionOffsetX = region.offsetX;
		attachment.regionOffsetY = region.offsetY;
		attachment.regionWidth = region.width;
		attachment.regionHeight = region.height;
		attachment.regionOriginalWidth = region.originalWidth;
		attachment.regionOriginalHeight = region.originalHeight;
		return attachment;
	},
	newMeshAttachment: function (skin, name, path) {
		var region = this.atlas.findRegion(path);
		if (!region) throw "Region not found in atlas: " + path + " (mesh attachment: " + name + ")";
		var attachment = new spine.MeshAttachment(name);
		attachment.rendererObject = region;
		attachment.regionU = region.u;
		attachment.regionV = region.v;
		attachment.regionU2 = region.u2;
		attachment.regionV2 = region.v2;
		attachment.regionRotate = region.rotate;
		attachment.regionOffsetX = region.offsetX;
		attachment.regionOffsetY = region.offsetY;
		attachment.regionWidth = region.width;
		attachment.regionHeight = region.height;
		attachment.regionOriginalWidth = region.originalWidth;
		attachment.regionOriginalHeight = region.originalHeight;
		return attachment;
	},
	newSkinnedMeshAttachment: function (skin, name, path) {
		var region = this.atlas.findRegion(path);
		if (!region) throw "Region not found in atlas: " + path + " (skinned mesh attachment: " + name + ")";
		var attachment = new spine.SkinnedMeshAttachment(name);
		attachment.rendererObject = region;
		attachment.regionU = region.u;
		attachment.regionV = region.v;
		attachment.regionU2 = region.u2;
		attachment.regionV2 = region.v2;
		attachment.regionRotate = region.rotate;
		attachment.regionOffsetX = region.offsetX;
		attachment.regionOffsetY = region.offsetY;
		attachment.regionWidth = region.width;
		attachment.regionHeight = region.height;
		attachment.regionOriginalWidth = region.originalWidth;
		attachment.regionOriginalHeight = region.originalHeight;
		return attachment;
	},
	newBoundingBoxAttachment: function (skin, name) {
		return new spine.BoundingBoxAttachment(name);
	}
};

spine.SkeletonBounds = function () {
	this.polygonPool = [];
	this.polygons = [];
	this.boundingBoxes = [];
};
spine.SkeletonBounds.prototype = {
	minX: 0, minY: 0, maxX: 0, maxY: 0,
	update: function (skeleton, updateAabb) {
		var slots = skeleton.slots;
		var slotCount = slots.length;
		var x = skeleton.x, y = skeleton.y;
		var boundingBoxes = this.boundingBoxes;
		var polygonPool = this.polygonPool;
		var polygons = this.polygons;

		boundingBoxes.length = 0;
		for (var i = 0, n = polygons.length; i < n; i++)
			polygonPool.push(polygons[i]);
		polygons.length = 0;

		for (var i = 0; i < slotCount; i++) {
			var slot = slots[i];
			var boundingBox = slot.attachment;
			if (boundingBox.type != spine.AttachmentType.boundingbox) continue;
			boundingBoxes.push(boundingBox);

			var poolCount = polygonPool.length, polygon;
			if (poolCount > 0) {
				polygon = polygonPool[poolCount - 1];
				polygonPool.splice(poolCount - 1, 1);
			} else
				polygon = [];
			polygons.push(polygon);

			polygon.length = boundingBox.vertices.length;
			boundingBox.computeWorldVertices(x, y, slot.bone, polygon);
		}

		if (updateAabb) this.aabbCompute();
	},
	aabbCompute: function () {
		var polygons = this.polygons;
		var minX = Number.MAX_VALUE, minY = Number.MAX_VALUE, maxX = Number.MIN_VALUE, maxY = Number.MIN_VALUE;
		for (var i = 0, n = polygons.length; i < n; i++) {
			var vertices = polygons[i];
			for (var ii = 0, nn = vertices.length; ii < nn; ii += 2) {
				var x = vertices[ii];
				var y = vertices[ii + 1];
				minX = Math.min(minX, x);
				minY = Math.min(minY, y);
				maxX = Math.max(maxX, x);
				maxY = Math.max(maxY, y);
			}
		}
		this.minX = minX;
		this.minY = minY;
		this.maxX = maxX;
		this.maxY = maxY;
	},
	/** Returns true if the axis aligned bounding box contains the point. */
	aabbContainsPoint: function (x, y) {
		return x >= this.minX && x <= this.maxX && y >= this.minY && y <= this.maxY;
	},
	/** Returns true if the axis aligned bounding box intersects the line segment. */
	aabbIntersectsSegment: function (x1, y1, x2, y2) {
		var minX = this.minX, minY = this.minY, maxX = this.maxX, maxY = this.maxY;
		if ((x1 <= minX && x2 <= minX) || (y1 <= minY && y2 <= minY) || (x1 >= maxX && x2 >= maxX) || (y1 >= maxY && y2 >= maxY))
			return false;
		var m = (y2 - y1) / (x2 - x1);
		var y = m * (minX - x1) + y1;
		if (y > minY && y < maxY) return true;
		y = m * (maxX - x1) + y1;
		if (y > minY && y < maxY) return true;
		var x = (minY - y1) / m + x1;
		if (x > minX && x < maxX) return true;
		x = (maxY - y1) / m + x1;
		if (x > minX && x < maxX) return true;
		return false;
	},
	/** Returns true if the axis aligned bounding box intersects the axis aligned bounding box of the specified bounds. */
	aabbIntersectsSkeleton: function (bounds) {
		return this.minX < bounds.maxX && this.maxX > bounds.minX && this.minY < bounds.maxY && this.maxY > bounds.minY;
	},
	/** Returns the first bounding box attachment that contains the point, or null. When doing many checks, it is usually more
	 * efficient to only call this method if {@link #aabbContainsPoint(float, float)} returns true. */
	containsPoint: function (x, y) {
		var polygons = this.polygons;
		for (var i = 0, n = polygons.length; i < n; i++)
			if (this.polygonContainsPoint(polygons[i], x, y)) return this.boundingBoxes[i];
		return null;
	},
	/** Returns the first bounding box attachment that contains the line segment, or null. When doing many checks, it is usually
	 * more efficient to only call this method if {@link #aabbIntersectsSegment(float, float, float, float)} returns true. */
	intersectsSegment: function (x1, y1, x2, y2) {
		var polygons = this.polygons;
		for (var i = 0, n = polygons.length; i < n; i++)
			if (polygons[i].intersectsSegment(x1, y1, x2, y2)) return this.boundingBoxes[i];
		return null;
	},
	/** Returns true if the polygon contains the point. */
	polygonContainsPoint: function (polygon, x, y) {
		var nn = polygon.length;
		var prevIndex = nn - 2;
		var inside = false;
		for (var ii = 0; ii < nn; ii += 2) {
			var vertexY = polygon[ii + 1];
			var prevY = polygon[prevIndex + 1];
			if ((vertexY < y && prevY >= y) || (prevY < y && vertexY >= y)) {
				var vertexX = polygon[ii];
				if (vertexX + (y - vertexY) / (prevY - vertexY) * (polygon[prevIndex] - vertexX) < x) inside = !inside;
			}
			prevIndex = ii;
		}
		return inside;
	},
	/** Returns true if the polygon contains the line segment. */
	polygonIntersectsSegment: function (polygon, x1, y1, x2, y2) {
		var nn = polygon.length;
		var width12 = x1 - x2, height12 = y1 - y2;
		var det1 = x1 * y2 - y1 * x2;
		var x3 = polygon[nn - 2], y3 = polygon[nn - 1];
		for (var ii = 0; ii < nn; ii += 2) {
			var x4 = polygon[ii], y4 = polygon[ii + 1];
			var det2 = x3 * y4 - y3 * x4;
			var width34 = x3 - x4, height34 = y3 - y4;
			var det3 = width12 * height34 - height12 * width34;
			var x = (det1 * width34 - width12 * det2) / det3;
			if (((x >= x3 && x <= x4) || (x >= x4 && x <= x3)) && ((x >= x1 && x <= x2) || (x >= x2 && x <= x1))) {
				var y = (det1 * height34 - height12 * det2) / det3;
				if (((y >= y3 && y <= y4) || (y >= y4 && y <= y3)) && ((y >= y1 && y <= y2) || (y >= y2 && y <= y1))) return true;
			}
			x3 = x4;
			y3 = y4;
		}
		return false;
	},
	getPolygon: function (attachment) {
		var index = this.boundingBoxes.indexOf(attachment);
		return index == -1 ? null : this.polygons[index];
	},
	getWidth: function () {
		return this.maxX - this.minX;
	},
	getHeight: function () {
		return this.maxY - this.minY;
	}
};
// *********************************
// CharmTeam Builder JavaScript file
// *********************************

/*
 CryptoJS v3.1.2
 code.google.com/p/crypto-js
 (c) 2009-2013 by Jeff Mott. All rights reserved.
 code.google.com/p/crypto-js/wiki/License
 */
/**
 * CryptoJS core components.
 */
var CryptoJS = CryptoJS || (function (Math, undefined) {
        /**
         * CryptoJS namespace.
         */
        var C = {};

        /**
         * Library namespace.
         */
        var C_lib = C.lib = {};

        /**
         * Base object for prototypal inheritance.
         */
        var Base = C_lib.Base = (function () {
            function F() {}

            return {
                /**
                 * Creates a new object that inherits from this object.
                 *
                 * @param {Object} overrides Properties to copy into the new object.
                 *
                 * @return {Object} The new object.
                 *
                 * @static
                 *
                 * @example
                 *
                 *     var MyType = CryptoJS.lib.Base.extend({
             *         field: 'value',
             *
             *         method: function () {
             *         }
             *     });
                 */
                extend: function (overrides) {
                    // Spawn
                    F.prototype = this;
                    var subtype = new F();

                    // Augment
                    if (overrides) {
                        subtype.mixIn(overrides);
                    }

                    // Create default initializer
                    if (!subtype.hasOwnProperty('init')) {
                        subtype.init = function () {
                            subtype.$super.init.apply(this, arguments);
                        };
                    }

                    // Initializer's prototype is the subtype object
                    subtype.init.prototype = subtype;

                    // Reference supertype
                    subtype.$super = this;

                    return subtype;
                },

                /**
                 * Extends this object and runs the init method.
                 * Arguments to create() will be passed to init().
                 *
                 * @return {Object} The new object.
                 *
                 * @static
                 *
                 * @example
                 *
                 *     var instance = MyType.create();
                 */
                create: function () {
                    var instance = this.extend();
                    instance.init.apply(instance, arguments);

                    return instance;
                },

                /**
                 * Initializes a newly created object.
                 * Override this method to add some logic when your objects are created.
                 *
                 * @example
                 *
                 *     var MyType = CryptoJS.lib.Base.extend({
             *         init: function () {
             *             // ...
             *         }
             *     });
                 */
                init: function () {
                },

                /**
                 * Copies properties into this object.
                 *
                 * @param {Object} properties The properties to mix in.
                 *
                 * @example
                 *
                 *     MyType.mixIn({
             *         field: 'value'
             *     });
                 */
                mixIn: function (properties) {
                    for (var propertyName in properties) {
                        if (properties.hasOwnProperty(propertyName)) {
                            this[propertyName] = properties[propertyName];
                        }
                    }

                    // IE won't copy toString using the loop above
                    if (properties.hasOwnProperty('toString')) {
                        this.toString = properties.toString;
                    }
                },

                /**
                 * Creates a copy of this object.
                 *
                 * @return {Object} The clone.
                 *
                 * @example
                 *
                 *     var clone = instance.clone();
                 */
                clone: function () {
                    return this.init.prototype.extend(this);
                }
            };
        }());

        /**
         * An array of 32-bit words.
         *
         * @property {Array} words The array of 32-bit words.
         * @property {number} sigBytes The number of significant bytes in this word array.
         */
        var WordArray = C_lib.WordArray = Base.extend({
            /**
             * Initializes a newly created word array.
             *
             * @param {Array} words (Optional) An array of 32-bit words.
             * @param {number} sigBytes (Optional) The number of significant bytes in the words.
             *
             * @example
             *
             *     var wordArray = CryptoJS.lib.WordArray.create();
             *     var wordArray = CryptoJS.lib.WordArray.create([0x00010203, 0x04050607]);
             *     var wordArray = CryptoJS.lib.WordArray.create([0x00010203, 0x04050607], 6);
             */
            init: function (words, sigBytes) {
                words = this.words = words || [];

                if (sigBytes != undefined) {
                    this.sigBytes = sigBytes;
                } else {
                    this.sigBytes = words.length * 4;
                }
            },

            /**
             * Converts this word array to a string.
             *
             * @param {Encoder} encoder (Optional) The encoding strategy to use. Default: CryptoJS.enc.Hex
             *
             * @return {string} The stringified word array.
             *
             * @example
             *
             *     var string = wordArray + '';
             *     var string = wordArray.toString();
             *     var string = wordArray.toString(CryptoJS.enc.Utf8);
             */
            toString: function (encoder) {
                return (encoder || Hex).stringify(this);
            },

            /**
             * Concatenates a word array to this word array.
             *
             * @param {WordArray} wordArray The word array to append.
             *
             * @return {WordArray} This word array.
             *
             * @example
             *
             *     wordArray1.concat(wordArray2);
             */
            concat: function (wordArray) {
                // Shortcuts
                var thisWords = this.words;
                var thatWords = wordArray.words;
                var thisSigBytes = this.sigBytes;
                var thatSigBytes = wordArray.sigBytes;

                // Clamp excess bits
                this.clamp();

                // Concat
                if (thisSigBytes % 4) {
                    // Copy one byte at a time
                    for (var i = 0; i < thatSigBytes; i++) {
                        var thatByte = (thatWords[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
                        thisWords[(thisSigBytes + i) >>> 2] |= thatByte << (24 - ((thisSigBytes + i) % 4) * 8);
                    }
                } else if (thatWords.length > 0xffff) {
                    // Copy one word at a time
                    for (var i = 0; i < thatSigBytes; i += 4) {
                        thisWords[(thisSigBytes + i) >>> 2] = thatWords[i >>> 2];
                    }
                } else {
                    // Copy all words at once
                    thisWords.push.apply(thisWords, thatWords);
                }
                this.sigBytes += thatSigBytes;

                // Chainable
                return this;
            },

            /**
             * Removes insignificant bits.
             *
             * @example
             *
             *     wordArray.clamp();
             */
            clamp: function () {
                // Shortcuts
                var words = this.words;
                var sigBytes = this.sigBytes;

                // Clamp
                words[sigBytes >>> 2] &= 0xffffffff << (32 - (sigBytes % 4) * 8);
                words.length = Math.ceil(sigBytes / 4);
            },

            /**
             * Creates a copy of this word array.
             *
             * @return {WordArray} The clone.
             *
             * @example
             *
             *     var clone = wordArray.clone();
             */
            clone: function () {
                var clone = Base.clone.call(this);
                clone.words = this.words.slice(0);

                return clone;
            },

            /**
             * Creates a word array filled with random bytes.
             *
             * @param {number} nBytes The number of random bytes to generate.
             *
             * @return {WordArray} The random word array.
             *
             * @static
             *
             * @example
             *
             *     var wordArray = CryptoJS.lib.WordArray.random(16);
             */
            random: function (nBytes) {
                var words = [];
                for (var i = 0; i < nBytes; i += 4) {
                    words.push((Math.random() * 0x100000000) | 0);
                }

                return new WordArray.init(words, nBytes);
            }
        });

        /**
         * Encoder namespace.
         */
        var C_enc = C.enc = {};

        /**
         * Hex encoding strategy.
         */
        var Hex = C_enc.Hex = {
            /**
             * Converts a word array to a hex string.
             *
             * @param {WordArray} wordArray The word array.
             *
             * @return {string} The hex string.
             *
             * @static
             *
             * @example
             *
             *     var hexString = CryptoJS.enc.Hex.stringify(wordArray);
             */
            stringify: function (wordArray) {
                // Shortcuts
                var words = wordArray.words;
                var sigBytes = wordArray.sigBytes;

                // Convert
                var hexChars = [];
                for (var i = 0; i < sigBytes; i++) {
                    var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
                    hexChars.push((bite >>> 4).toString(16));
                    hexChars.push((bite & 0x0f).toString(16));
                }

                return hexChars.join('');
            },

            /**
             * Converts a hex string to a word array.
             *
             * @param {string} hexStr The hex string.
             *
             * @return {WordArray} The word array.
             *
             * @static
             *
             * @example
             *
             *     var wordArray = CryptoJS.enc.Hex.parse(hexString);
             */
            parse: function (hexStr) {
                // Shortcut
                var hexStrLength = hexStr.length;

                // Convert
                var words = [];
                for (var i = 0; i < hexStrLength; i += 2) {
                    words[i >>> 3] |= parseInt(hexStr.substr(i, 2), 16) << (24 - (i % 8) * 4);
                }

                return new WordArray.init(words, hexStrLength / 2);
            }
        };

        /**
         * Latin1 encoding strategy.
         */
        var Latin1 = C_enc.Latin1 = {
            /**
             * Converts a word array to a Latin1 string.
             *
             * @param {WordArray} wordArray The word array.
             *
             * @return {string} The Latin1 string.
             *
             * @static
             *
             * @example
             *
             *     var latin1String = CryptoJS.enc.Latin1.stringify(wordArray);
             */
            stringify: function (wordArray) {
                // Shortcuts
                var words = wordArray.words;
                var sigBytes = wordArray.sigBytes;

                // Convert
                var latin1Chars = [];
                for (var i = 0; i < sigBytes; i++) {
                    var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
                    latin1Chars.push(String.fromCharCode(bite));
                }

                return latin1Chars.join('');
            },

            /**
             * Converts a Latin1 string to a word array.
             *
             * @param {string} latin1Str The Latin1 string.
             *
             * @return {WordArray} The word array.
             *
             * @static
             *
             * @example
             *
             *     var wordArray = CryptoJS.enc.Latin1.parse(latin1String);
             */
            parse: function (latin1Str) {
                // Shortcut
                var latin1StrLength = latin1Str.length;

                // Convert
                var words = [];
                for (var i = 0; i < latin1StrLength; i++) {
                    words[i >>> 2] |= (latin1Str.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
                }

                return new WordArray.init(words, latin1StrLength);
            }
        };

        /**
         * UTF-8 encoding strategy.
         */
        var Utf8 = C_enc.Utf8 = {
            /**
             * Converts a word array to a UTF-8 string.
             *
             * @param {WordArray} wordArray The word array.
             *
             * @return {string} The UTF-8 string.
             *
             * @static
             *
             * @example
             *
             *     var utf8String = CryptoJS.enc.Utf8.stringify(wordArray);
             */
            stringify: function (wordArray) {
                try {
                    return decodeURIComponent(escape(Latin1.stringify(wordArray)));
                } catch (e) {
                    throw new Error('Malformed UTF-8 data');
                }
            },

            /**
             * Converts a UTF-8 string to a word array.
             *
             * @param {string} utf8Str The UTF-8 string.
             *
             * @return {WordArray} The word array.
             *
             * @static
             *
             * @example
             *
             *     var wordArray = CryptoJS.enc.Utf8.parse(utf8String);
             */
            parse: function (utf8Str) {
                return Latin1.parse(unescape(encodeURIComponent(utf8Str)));
            }
        };

        /**
         * Abstract buffered block algorithm template.
         *
         * The property blockSize must be implemented in a concrete subtype.
         *
         * @property {number} _minBufferSize The number of blocks that should be kept unprocessed in the buffer. Default: 0
         */
        var BufferedBlockAlgorithm = C_lib.BufferedBlockAlgorithm = Base.extend({
            /**
             * Resets this block algorithm's data buffer to its initial state.
             *
             * @example
             *
             *     bufferedBlockAlgorithm.reset();
             */
            reset: function () {
                // Initial values
                this._data = new WordArray.init();
                this._nDataBytes = 0;
            },

            /**
             * Adds new data to this block algorithm's buffer.
             *
             * @param {WordArray|string} data The data to append. Strings are converted to a WordArray using UTF-8.
             *
             * @example
             *
             *     bufferedBlockAlgorithm._append('data');
             *     bufferedBlockAlgorithm._append(wordArray);
             */
            _append: function (data) {
                // Convert string to WordArray, else assume WordArray already
                if (typeof data == 'string') {
                    data = Utf8.parse(data);
                }

                // Append
                this._data.concat(data);
                this._nDataBytes += data.sigBytes;
            },

            /**
             * Processes available data blocks.
             *
             * This method invokes _doProcessBlock(offset), which must be implemented by a concrete subtype.
             *
             * @param {boolean} doFlush Whether all blocks and partial blocks should be processed.
             *
             * @return {WordArray} The processed data.
             *
             * @example
             *
             *     var processedData = bufferedBlockAlgorithm._process();
             *     var processedData = bufferedBlockAlgorithm._process(!!'flush');
             */
            _process: function (doFlush) {
                // Shortcuts
                var data = this._data;
                var dataWords = data.words;
                var dataSigBytes = data.sigBytes;
                var blockSize = this.blockSize;
                var blockSizeBytes = blockSize * 4;

                // Count blocks ready
                var nBlocksReady = dataSigBytes / blockSizeBytes;
                if (doFlush) {
                    // Round up to include partial blocks
                    nBlocksReady = Math.ceil(nBlocksReady);
                } else {
                    // Round down to include only full blocks,
                    // less the number of blocks that must remain in the buffer
                    nBlocksReady = Math.max((nBlocksReady | 0) - this._minBufferSize, 0);
                }

                // Count words ready
                var nWordsReady = nBlocksReady * blockSize;

                // Count bytes ready
                var nBytesReady = Math.min(nWordsReady * 4, dataSigBytes);

                // Process blocks
                if (nWordsReady) {
                    for (var offset = 0; offset < nWordsReady; offset += blockSize) {
                        // Perform concrete-algorithm logic
                        this._doProcessBlock(dataWords, offset);
                    }

                    // Remove processed words
                    var processedWords = dataWords.splice(0, nWordsReady);
                    data.sigBytes -= nBytesReady;
                }

                // Return processed words
                return new WordArray.init(processedWords, nBytesReady);
            },

            /**
             * Creates a copy of this object.
             *
             * @return {Object} The clone.
             *
             * @example
             *
             *     var clone = bufferedBlockAlgorithm.clone();
             */
            clone: function () {
                var clone = Base.clone.call(this);
                clone._data = this._data.clone();

                return clone;
            },

            _minBufferSize: 0
        });

        /**
         * Abstract hasher template.
         *
         * @property {number} blockSize The number of 32-bit words this hasher operates on. Default: 16 (512 bits)
         */
        var Hasher = C_lib.Hasher = BufferedBlockAlgorithm.extend({
            /**
             * Configuration options.
             */
            cfg: Base.extend(),

            /**
             * Initializes a newly created hasher.
             *
             * @param {Object} cfg (Optional) The configuration options to use for this hash computation.
             *
             * @example
             *
             *     var hasher = CryptoJS.algo.SHA256.create();
             */
            init: function (cfg) {
                // Apply config defaults
                this.cfg = this.cfg.extend(cfg);

                // Set initial values
                this.reset();
            },

            /**
             * Resets this hasher to its initial state.
             *
             * @example
             *
             *     hasher.reset();
             */
            reset: function () {
                // Reset data buffer
                BufferedBlockAlgorithm.reset.call(this);

                // Perform concrete-hasher logic
                this._doReset();
            },

            /**
             * Updates this hasher with a message.
             *
             * @param {WordArray|string} messageUpdate The message to append.
             *
             * @return {Hasher} This hasher.
             *
             * @example
             *
             *     hasher.update('message');
             *     hasher.update(wordArray);
             */
            update: function (messageUpdate) {
                // Append
                this._append(messageUpdate);

                // Update the hash
                this._process();

                // Chainable
                return this;
            },

            /**
             * Finalizes the hash computation.
             * Note that the finalize operation is effectively a destructive, read-once operation.
             *
             * @param {WordArray|string} messageUpdate (Optional) A final message update.
             *
             * @return {WordArray} The hash.
             *
             * @example
             *
             *     var hash = hasher.finalize();
             *     var hash = hasher.finalize('message');
             *     var hash = hasher.finalize(wordArray);
             */
            finalize: function (messageUpdate) {
                // Final message update
                if (messageUpdate) {
                    this._append(messageUpdate);
                }

                // Perform concrete-hasher logic
                var hash = this._doFinalize();

                return hash;
            },

            blockSize: 512/32,

            /**
             * Creates a shortcut function to a hasher's object interface.
             *
             * @param {Hasher} hasher The hasher to create a helper for.
             *
             * @return {Function} The shortcut function.
             *
             * @static
             *
             * @example
             *
             *     var SHA256 = CryptoJS.lib.Hasher._createHelper(CryptoJS.algo.SHA256);
             */
            _createHelper: function (hasher) {
                return function (message, cfg) {
                    return new hasher.init(cfg).finalize(message);
                };
            },

            /**
             * Creates a shortcut function to the HMAC's object interface.
             *
             * @param {Hasher} hasher The hasher to use in this HMAC helper.
             *
             * @return {Function} The shortcut function.
             *
             * @static
             *
             * @example
             *
             *     var HmacSHA256 = CryptoJS.lib.Hasher._createHmacHelper(CryptoJS.algo.SHA256);
             */
            _createHmacHelper: function (hasher) {
                return function (message, key) {
                    return new C_algo.HMAC.init(hasher, key).finalize(message);
                };
            }
        });

        /**
         * Algorithm namespace.
         */
        var C_algo = C.algo = {};

        return C;
    }(Math));

window["Crypto"] = CryptoJS;

/*
 CryptoJS v3.1.2
 code.google.com/p/crypto-js
 (c) 2009-2013 by Jeff Mott. All rights reserved.
 code.google.com/p/crypto-js/wiki/License
 */
(function () {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var Base = C_lib.Base;
    var C_enc = C.enc;
    var Utf8 = C_enc.Utf8;
    var C_algo = C.algo;

    /**
     * HMAC algorithm.
     */
    var HMAC = C_algo.HMAC = Base.extend({
        /**
         * Initializes a newly created HMAC.
         *
         * @param {Hasher} hasher The hash algorithm to use.
         * @param {WordArray|string} key The secret key.
         *
         * @example
         *
         *     var hmacHasher = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, key);
         */
        init: function (hasher, key) {
            // Init hasher
            hasher = this._hasher = new hasher.init();

            // Convert string to WordArray, else assume WordArray already
            if (typeof key == 'string') {
                key = Utf8.parse(key);
            }

            // Shortcuts
            var hasherBlockSize = hasher.blockSize;
            var hasherBlockSizeBytes = hasherBlockSize * 4;

            // Allow arbitrary length keys
            if (key.sigBytes > hasherBlockSizeBytes) {
                key = hasher.finalize(key);
            }

            // Clamp excess bits
            key.clamp();

            // Clone key for inner and outer pads
            var oKey = this._oKey = key.clone();
            var iKey = this._iKey = key.clone();

            // Shortcuts
            var oKeyWords = oKey.words;
            var iKeyWords = iKey.words;

            // XOR keys with pad constants
            for (var i = 0; i < hasherBlockSize; i++) {
                oKeyWords[i] ^= 0x5c5c5c5c;
                iKeyWords[i] ^= 0x36363636;
            }
            oKey.sigBytes = iKey.sigBytes = hasherBlockSizeBytes;

            // Set initial values
            this.reset();
        },

        /**
         * Resets this HMAC to its initial state.
         *
         * @example
         *
         *     hmacHasher.reset();
         */
        reset: function () {
            // Shortcut
            var hasher = this._hasher;

            // Reset
            hasher.reset();
            hasher.update(this._iKey);
        },

        /**
         * Updates this HMAC with a message.
         *
         * @param {WordArray|string} messageUpdate The message to append.
         *
         * @return {HMAC} This HMAC instance.
         *
         * @example
         *
         *     hmacHasher.update('message');
         *     hmacHasher.update(wordArray);
         */
        update: function (messageUpdate) {
            this._hasher.update(messageUpdate);

            // Chainable
            return this;
        },

        /**
         * Finalizes the HMAC computation.
         * Note that the finalize operation is effectively a destructive, read-once operation.
         *
         * @param {WordArray|string} messageUpdate (Optional) A final message update.
         *
         * @return {WordArray} The HMAC.
         *
         * @example
         *
         *     var hmac = hmacHasher.finalize();
         *     var hmac = hmacHasher.finalize('message');
         *     var hmac = hmacHasher.finalize(wordArray);
         */
        finalize: function (messageUpdate) {
            // Shortcut
            var hasher = this._hasher;

            // Compute HMAC
            var innerHash = hasher.finalize(messageUpdate);
            hasher.reset();
            var hmac = hasher.finalize(this._oKey.clone().concat(innerHash));

            return hmac;
        }
    });
}());

/*
 CryptoJS v3.1.2
 code.google.com/p/crypto-js
 (c) 2009-2013 by Jeff Mott. All rights reserved.
 code.google.com/p/crypto-js/wiki/License
 */
(function (Math) {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var WordArray = C_lib.WordArray;
    var Hasher = C_lib.Hasher;
    var C_algo = C.algo;

    // Initialization and round constants tables
    var H = [];
    var K = [];

    // Compute constants
    (function () {
        function isPrime(n) {
            var sqrtN = Math.sqrt(n);
            for (var factor = 2; factor <= sqrtN; factor++) {
                if (!(n % factor)) {
                    return false;
                }
            }

            return true;
        }

        function getFractionalBits(n) {
            return ((n - (n | 0)) * 0x100000000) | 0;
        }

        var n = 2;
        var nPrime = 0;
        while (nPrime < 64) {
            if (isPrime(n)) {
                if (nPrime < 8) {
                    H[nPrime] = getFractionalBits(Math.pow(n, 1 / 2));
                }
                K[nPrime] = getFractionalBits(Math.pow(n, 1 / 3));

                nPrime++;
            }

            n++;
        }
    }());

    // Reusable object
    var W = [];

    /**
     * SHA-256 hash algorithm.
     */
    var SHA256 = C_algo.SHA256 = Hasher.extend({
        _doReset: function () {
            this._hash = new WordArray.init(H.slice(0));
        },

        _doProcessBlock: function (M, offset) {
            // Shortcut
            var H = this._hash.words;

            // Working variables
            var a = H[0];
            var b = H[1];
            var c = H[2];
            var d = H[3];
            var e = H[4];
            var f = H[5];
            var g = H[6];
            var h = H[7];

            // Computation
            for (var i = 0; i < 64; i++) {
                if (i < 16) {
                    W[i] = M[offset + i] | 0;
                } else {
                    var gamma0x = W[i - 15];
                    var gamma0  = ((gamma0x << 25) | (gamma0x >>> 7))  ^
                        ((gamma0x << 14) | (gamma0x >>> 18)) ^
                        (gamma0x >>> 3);

                    var gamma1x = W[i - 2];
                    var gamma1  = ((gamma1x << 15) | (gamma1x >>> 17)) ^
                        ((gamma1x << 13) | (gamma1x >>> 19)) ^
                        (gamma1x >>> 10);

                    W[i] = gamma0 + W[i - 7] + gamma1 + W[i - 16];
                }

                var ch  = (e & f) ^ (~e & g);
                var maj = (a & b) ^ (a & c) ^ (b & c);

                var sigma0 = ((a << 30) | (a >>> 2)) ^ ((a << 19) | (a >>> 13)) ^ ((a << 10) | (a >>> 22));
                var sigma1 = ((e << 26) | (e >>> 6)) ^ ((e << 21) | (e >>> 11)) ^ ((e << 7)  | (e >>> 25));

                var t1 = h + sigma1 + ch + K[i] + W[i];
                var t2 = sigma0 + maj;

                h = g;
                g = f;
                f = e;
                e = (d + t1) | 0;
                d = c;
                c = b;
                b = a;
                a = (t1 + t2) | 0;
            }

            // Intermediate hash value
            H[0] = (H[0] + a) | 0;
            H[1] = (H[1] + b) | 0;
            H[2] = (H[2] + c) | 0;
            H[3] = (H[3] + d) | 0;
            H[4] = (H[4] + e) | 0;
            H[5] = (H[5] + f) | 0;
            H[6] = (H[6] + g) | 0;
            H[7] = (H[7] + h) | 0;
        },

        _doFinalize: function () {
            // Shortcuts
            var data = this._data;
            var dataWords = data.words;

            var nBitsTotal = this._nDataBytes * 8;
            var nBitsLeft = data.sigBytes * 8;

            // Add padding
            dataWords[nBitsLeft >>> 5] |= 0x80 << (24 - nBitsLeft % 32);
            dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 14] = Math.floor(nBitsTotal / 0x100000000);
            dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 15] = nBitsTotal;
            data.sigBytes = dataWords.length * 4;

            // Hash final blocks
            this._process();

            // Return final computed hash
            return this._hash;
        },

        clone: function () {
            var clone = Hasher.clone.call(this);
            clone._hash = this._hash.clone();

            return clone;
        }
    });

    /**
     * Shortcut function to the hasher's object interface.
     *
     * @param {WordArray|string} message The message to hash.
     *
     * @return {WordArray} The hash.
     *
     * @static
     *
     * @example
     *
     *     var hash = CryptoJS.SHA256('message');
     *     var hash = CryptoJS.SHA256(wordArray);
     */
    C.SHA256 = Hasher._createHelper(SHA256);

    /**
     * Shortcut function to the HMAC's object interface.
     *
     * @param {WordArray|string} message The message to hash.
     * @param {WordArray|string} key The secret key.
     *
     * @return {WordArray} The HMAC.
     *
     * @static
     *
     * @example
     *
     *     var hmac = CryptoJS.HmacSHA256(message, key);
     */
    C.HmacSHA256 = Hasher._createHmacHelper(SHA256);
}(Math));

/*
 CryptoJS v3.1.2
 code.google.com/p/crypto-js
 (c) 2009-2013 by Jeff Mott. All rights reserved.
 code.google.com/p/crypto-js/wiki/License
 */
(function () {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var WordArray = C_lib.WordArray;
    var C_enc = C.enc;

    /**
     * Base64 encoding strategy.
     */
    var Base64 = C_enc.Base64 = {
        /**
         * Converts a word array to a Base64 string.
         *
         * @param {WordArray} wordArray The word array.
         *
         * @return {string} The Base64 string.
         *
         * @static
         *
         * @example
         *
         *     var base64String = CryptoJS.enc.Base64.stringify(wordArray);
         */
        stringify: function (wordArray) {
            // Shortcuts
            var words = wordArray.words;
            var sigBytes = wordArray.sigBytes;
            var map = this._map;

            // Clamp excess bits
            wordArray.clamp();

            // Convert
            var base64Chars = [];
            for (var i = 0; i < sigBytes; i += 3) {
                var byte1 = (words[i >>> 2]       >>> (24 - (i % 4) * 8))       & 0xff;
                var byte2 = (words[(i + 1) >>> 2] >>> (24 - ((i + 1) % 4) * 8)) & 0xff;
                var byte3 = (words[(i + 2) >>> 2] >>> (24 - ((i + 2) % 4) * 8)) & 0xff;

                var triplet = (byte1 << 16) | (byte2 << 8) | byte3;

                for (var j = 0; (j < 4) && (i + j * 0.75 < sigBytes); j++) {
                    base64Chars.push(map.charAt((triplet >>> (6 * (3 - j))) & 0x3f));
                }
            }

            // Add padding
            var paddingChar = map.charAt(64);
            if (paddingChar) {
                while (base64Chars.length % 4) {
                    base64Chars.push(paddingChar);
                }
            }

            return base64Chars.join('');
        },

        /**
         * Converts a Base64 string to a word array.
         *
         * @param {string} base64Str The Base64 string.
         *
         * @return {WordArray} The word array.
         *
         * @static
         *
         * @example
         *
         *     var wordArray = CryptoJS.enc.Base64.parse(base64String);
         */
        parse: function (base64Str) {
            // Shortcuts
            var base64StrLength = base64Str.length;
            var map = this._map;

            // Ignore padding
            var paddingChar = map.charAt(64);
            if (paddingChar) {
                var paddingIndex = base64Str.indexOf(paddingChar);
                if (paddingIndex != -1) {
                    base64StrLength = paddingIndex;
                }
            }

            // Convert
            var words = [];
            var nBytes = 0;
            for (var i = 0; i < base64StrLength; i++) {
                if (i % 4) {
                    var bits1 = map.indexOf(base64Str.charAt(i - 1)) << ((i % 4) * 2);
                    var bits2 = map.indexOf(base64Str.charAt(i)) >>> (6 - (i % 4) * 2);
                    words[nBytes >>> 2] |= (bits1 | bits2) << (24 - (nBytes % 4) * 8);
                    nBytes++;
                }
            }

            return WordArray.create(words, nBytes);
        },

        _map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
    };
}());
(function(scope){
var CryptoJS=CryptoJS||function(e,n){var t={},i=t.lib={},r=function(){},s=i.Base={extend:function(e){r.prototype=this;var n=new r;return e&&n.mixIn(e),n.hasOwnProperty("init")||(n.init=function(){n.$super.init.apply(this,arguments)}),n.init.prototype=n,n.$super=this,n},create:function(){var e=this.extend();return e.init.apply(e,arguments),e},init:function(){},mixIn:function(e){for(var n in e)e.hasOwnProperty(n)&&(this[n]=e[n]);e.hasOwnProperty("toString")&&(this.toString=e.toString)},clone:function(){return this.init.prototype.extend(this)}},o=i.WordArray=s.extend({init:function(e,n){e=this.words=e||[],this.sigBytes=void 0!=n?n:4*e.length},toString:function(e){return(e||u).stringify(this)},concat:function(e){var n=this.words,t=e.words,i=this.sigBytes;if(e=e.sigBytes,this.clamp(),i%4)for(var r=0;r<e;r++)n[i+r>>>2]|=(t[r>>>2]>>>24-r%4*8&255)<<24-(i+r)%4*8;else if(65535<t.length)for(r=0;r<e;r+=4)n[i+r>>>2]=t[r>>>2];else n.push.apply(n,t);return this.sigBytes+=e,this},clamp:function(){var n=this.words,t=this.sigBytes;n[t>>>2]&=4294967295<<32-t%4*8,n.length=e.ceil(t/4)},clone:function(){var e=s.clone.call(this);return e.words=this.words.slice(0),e},random:function(n){for(var t=[],i=0;i<n;i+=4)t.push(4294967296*e.random()|0);return new o.init(t,n)}}),a=t.enc={},u=a.Hex={stringify:function(e){var n=e.words;e=e.sigBytes;for(var t=[],i=0;i<e;i++){var r=n[i>>>2]>>>24-i%4*8&255;t.push((r>>>4).toString(16)),t.push((15&r).toString(16))}return t.join("")},parse:function(e){for(var n=e.length,t=[],i=0;i<n;i+=2)t[i>>>3]|=parseInt(e.substr(i,2),16)<<24-i%8*4;return new o.init(t,n/2)}},c=a.Latin1={stringify:function(e){var n=e.words;e=e.sigBytes;for(var t=[],i=0;i<e;i++)t.push(String.fromCharCode(n[i>>>2]>>>24-i%4*8&255));return t.join("")},parse:function(e){for(var n=e.length,t=[],i=0;i<n;i++)t[i>>>2]|=(255&e.charCodeAt(i))<<24-i%4*8;return new o.init(t,n)}},d=a.Utf8={stringify:function(e){try{return decodeURIComponent(escape(c.stringify(e)))}catch(e){throw Error("Malformed UTF-8 data")}},parse:function(e){return c.parse(unescape(encodeURIComponent(e)))}},l=i.BufferedBlockAlgorithm=s.extend({reset:function(){this._data=new o.init,this._nDataBytes=0},_append:function(e){"string"==typeof e&&(e=d.parse(e)),this._data.concat(e),this._nDataBytes+=e.sigBytes},_process:function(n){var t=this._data,i=t.words,r=t.sigBytes,s=this.blockSize,a=r/(4*s),a=n?e.ceil(a):e.max((0|a)-this._minBufferSize,0);if(n=a*s,r=e.min(4*n,r),n){for(var u=0;u<n;u+=s)this._doProcessBlock(i,u);u=i.splice(0,n),t.sigBytes-=r}return new o.init(u,r)},clone:function(){var e=s.clone.call(this);return e._data=this._data.clone(),e},_minBufferSize:0});i.Hasher=l.extend({cfg:s.extend(),init:function(e){this.cfg=this.cfg.extend(e),this.reset()},reset:function(){l.reset.call(this),this._doReset()},update:function(e){return this._append(e),this._process(),this},finalize:function(e){return e&&this._append(e),this._doFinalize()},blockSize:16,_createHelper:function(e){return function(n,t){return new e.init(t).finalize(n)}},_createHmacHelper:function(e){return function(n,t){return new f.HMAC.init(e,t).finalize(n)}}});var f=t.algo={};return t}(Math);!function(e){for(var n=CryptoJS,t=n.lib,i=t.WordArray,r=t.Hasher,t=n.algo,s=[],o=[],a=function(e){return 4294967296*(e-(0|e))|0},u=2,c=0;64>c;){var d;e:{d=u;for(var l=e.sqrt(d),f=2;f<=l;f++)if(!(d%f)){d=!1;break e}d=!0}d&&(8>c&&(s[c]=a(e.pow(u,.5))),o[c]=a(e.pow(u,1/3)),c++),u++}var v=[],t=t.SHA256=r.extend({_doReset:function(){this._hash=new i.init(s.slice(0))},_doProcessBlock:function(e,n){for(var t=this._hash.words,i=t[0],r=t[1],s=t[2],a=t[3],u=t[4],c=t[5],d=t[6],l=t[7],f=0;64>f;f++){if(16>f)v[f]=0|e[n+f];else{var g=v[f-15],m=v[f-2];v[f]=((g<<25|g>>>7)^(g<<14|g>>>18)^g>>>3)+v[f-7]+((m<<15|m>>>17)^(m<<13|m>>>19)^m>>>10)+v[f-16]}g=l+((u<<26|u>>>6)^(u<<21|u>>>11)^(u<<7|u>>>25))+(u&c^~u&d)+o[f]+v[f],m=((i<<30|i>>>2)^(i<<19|i>>>13)^(i<<10|i>>>22))+(i&r^i&s^r&s),l=d,d=c,c=u,u=a+g|0,a=s,s=r,r=i,i=g+m|0}t[0]=t[0]+i|0,t[1]=t[1]+r|0,t[2]=t[2]+s|0,t[3]=t[3]+a|0,t[4]=t[4]+u|0,t[5]=t[5]+c|0,t[6]=t[6]+d|0,t[7]=t[7]+l|0},_doFinalize:function(){var n=this._data,t=n.words,i=8*this._nDataBytes,r=8*n.sigBytes;return t[r>>>5]|=128<<24-r%32,t[14+(r+64>>>9<<4)]=e.floor(i/4294967296),t[15+(r+64>>>9<<4)]=i,n.sigBytes=4*t.length,this._process(),this._hash},clone:function(){var e=r.clone.call(this);return e._hash=this._hash.clone(),e}});n.SHA256=r._createHelper(t),n.HmacSHA256=r._createHmacHelper(t)}(Math),function(){var e=CryptoJS,n=e.enc.Utf8;e.algo.HMAC=e.lib.Base.extend({init:function(e,t){e=this._hasher=new e.init,"string"==typeof t&&(t=n.parse(t));var i=e.blockSize,r=4*i;t.sigBytes>r&&(t=e.finalize(t)),t.clamp();for(var s=this._oKey=t.clone(),o=this._iKey=t.clone(),a=s.words,u=o.words,c=0;c<i;c++)a[c]^=1549556828,u[c]^=909522486;s.sigBytes=o.sigBytes=r,this.reset()},reset:function(){var e=this._hasher;e.reset(),e.update(this._iKey)},update:function(e){return this._hasher.update(e),this},finalize:function(e){var n=this._hasher;return e=n.finalize(e),n.reset(),n.finalize(this._oKey.clone().concat(e))}})}(),function(){var e=CryptoJS,n=e.lib.WordArray;e.enc.Base64={stringify:function(e){var n=e.words,t=e.sigBytes,i=this._map;e.clamp(),e=[];for(var r=0;r<t;r+=3)for(var s=(n[r>>>2]>>>24-r%4*8&255)<<16|(n[r+1>>>2]>>>24-(r+1)%4*8&255)<<8|n[r+2>>>2]>>>24-(r+2)%4*8&255,o=0;4>o&&r+.75*o<t;o++)e.push(i.charAt(s>>>6*(3-o)&63));if(n=i.charAt(64))for(;e.length%4;)e.push(n);return e.join("")},parse:function(e){var t=e.length,i=this._map,r=i.charAt(64);r&&-1!=(r=e.indexOf(r))&&(t=r);for(var r=[],s=0,o=0;o<t;o++)if(o%4){var a=i.indexOf(e.charAt(o-1))<<o%4*2,u=i.indexOf(e.charAt(o))>>>6-o%4*2;r[s>>>2]|=(a|u)<<24-s%4*8,s++}return n.create(r,s)},_map:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="}}();var ganalyticsxyz;!function(e){!function(e){e[e.Undefined=0]="Undefined",e[e.Debug=1]="Debug",e[e.Info=2]="Info",e[e.Warning=3]="Warning",e[e.Error=4]="Error",e[e.Critical=5]="Critical"}(e.EGAErrorSeverity||(e.EGAErrorSeverity={}));!function(e){e[e.Undefined=0]="Undefined",e[e.Male=1]="Male",e[e.Female=2]="Female"}(e.EGAGender||(e.EGAGender={}));!function(e){e[e.Undefined=0]="Undefined",e[e.Start=1]="Start",e[e.Complete=2]="Complete",e[e.Fail=3]="Fail"}(e.EGAProgressionStatus||(e.EGAProgressionStatus={}));!function(e){e[e.Undefined=0]="Undefined",e[e.Source=1]="Source",e[e.Sink=2]="Sink"}(e.EGAResourceFlowType||(e.EGAResourceFlowType={}));!function(e){!function(e){e[e.Undefined=0]="Undefined",e[e.Rejected=1]="Rejected"}(e.EGASdkErrorType||(e.EGASdkErrorType={}));!function(e){e[e.NoResponse=0]="NoResponse",e[e.BadResponse=1]="BadResponse",e[e.RequestTimeout=2]="RequestTimeout",e[e.JsonEncodeFailed=3]="JsonEncodeFailed",e[e.JsonDecodeFailed=4]="JsonDecodeFailed",e[e.InternalServerError=5]="InternalServerError",e[e.BadRequest=6]="BadRequest",e[e.Unauthorized=7]="Unauthorized",e[e.UnknownResponseCode=8]="UnknownResponseCode",e[e.Ok=9]="Ok"}(e.EGAHTTPApiResponse||(e.EGAHTTPApiResponse={}))}(e.http||(e.http={}))}(ganalyticsxyz||(ganalyticsxyz={}));var EGAErrorSeverity=ganalyticsxyz.EGAErrorSeverity,EGAGender=ganalyticsxyz.EGAGender,EGAProgressionStatus=ganalyticsxyz.EGAProgressionStatus,EGAResourceFlowType=ganalyticsxyz.EGAResourceFlowType,ganalyticsxyz;!function(e){!function(e){var n;!function(e){e[e.Error=0]="Error",e[e.Warning=1]="Warning",e[e.Info=2]="Info",e[e.Debug=3]="Debug"}(n||(n={}));var t=function(){function e(){e.debugEnabled=!1}return e.setInfoLog=function(n){e.instance.infoLogEnabled=n},e.setVerboseLog=function(n){e.instance.infoLogVerboseEnabled=n},e.i=function(t){if(e.instance.infoLogEnabled){var i="Info/"+e.Tag+": "+t;e.instance.sendNotificationMessage(i,n.Info)}},e.w=function(t){var i="Warning/"+e.Tag+": "+t;e.instance.sendNotificationMessage(i,n.Warning)},e.e=function(t){var i="Error/"+e.Tag+": "+t;e.instance.sendNotificationMessage(i,n.Error)},e.ii=function(t){if(e.instance.infoLogVerboseEnabled){var i="Verbose/"+e.Tag+": "+t;e.instance.sendNotificationMessage(i,n.Info)}},e.d=function(t){if(e.debugEnabled){var i="Debug/"+e.Tag+": "+t;e.instance.sendNotificationMessage(i,n.Debug)}},e.prototype.sendNotificationMessage=function(e,t){switch(t){case n.Error:console.error(e);break;case n.Warning:console.warn(e);break;case n.Debug:"function"==typeof console.debug?console.debug(e):console.log(e);break;case n.Info:console.log(e)}},e}();t.instance=new t,t.Tag="Ganalyticsxyz",e.GALogger=t}(e.logging||(e.logging={}))}(ganalyticsxyz||(ganalyticsxyz={}));var ganalyticsxyz;!function(e){!function(n){var t=e.logging.GALogger,i=function(){function e(){}return e.getHmac=function(e,n){var t=CryptoJS.HmacSHA256(n,e);return CryptoJS.enc.Base64.stringify(t)},e.stringMatch=function(e,n){return!(!e||!n)&&n.test(e)},e.joinStringArray=function(e,n){for(var t="",i=0,r=e.length;i<r;i++)i>0&&(t+=n),t+=e[i];return t},e.stringArrayContainsString=function(e,n){if(0===e.length)return!1;for(var t in e)if(e[t]===n)return!0;return!1},e.encode64=function(n){n=encodeURI(n);var t,i,r,s,o,a="",u=0,c=0,d=0;do{t=n.charCodeAt(d++),i=n.charCodeAt(d++),u=n.charCodeAt(d++),r=t>>2,s=(3&t)<<4|i>>4,o=(15&i)<<2|u>>6,c=63&u,isNaN(i)?o=c=64:isNaN(u)&&(c=64),a=a+e.keyStr.charAt(r)+e.keyStr.charAt(s)+e.keyStr.charAt(o)+e.keyStr.charAt(c),t=i=u=0,r=s=o=c=0}while(d<n.length);return a},e.decode64=function(n){var i,r,s,o,a,u="",c=0,d=0,l=0;/[^A-Za-z0-9\+\/\=]/g.exec(n)&&t.w("There were invalid base64 characters in the input text. Valid base64 characters are A-Z, a-z, 0-9, '+', '/',and '='. Expect errors in decoding."),n=n.replace(/[^A-Za-z0-9\+\/\=]/g,"");do{s=e.keyStr.indexOf(n.charAt(l++)),o=e.keyStr.indexOf(n.charAt(l++)),a=e.keyStr.indexOf(n.charAt(l++)),d=e.keyStr.indexOf(n.charAt(l++)),i=s<<2|o>>4,r=(15&o)<<4|a>>2,c=(3&a)<<6|d,u+=String.fromCharCode(i),64!=a&&(u+=String.fromCharCode(r)),64!=d&&(u+=String.fromCharCode(c)),i=r=c=0,s=o=a=d=0}while(l<n.length);return decodeURI(u)},e.timeIntervalSince1970=function(){var e=new Date;return Math.round(e.getTime()/1e3)},e.createGuid=function(){return(e.s4()+e.s4()+"-"+e.s4()+"-4"+e.s4().substr(0,3)+"-"+e.s4()+"-"+e.s4()+e.s4()+e.s4()).toLowerCase()},e.s4=function(){return(65536*(1+Math.random())|0).toString(16).substring(1)},e}();i.keyStr="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",n.GAUtilities=i}(e.utilities||(e.utilities={}))}(ganalyticsxyz||(ganalyticsxyz={}));var ganalyticsxyz;!function(e){!function(n){var t=e.logging.GALogger,i=e.http.EGASdkErrorType,r=e.utilities.GAUtilities,s=function(){function n(){}return n.validateBusinessEvent=function(e,i,r,s,o){return n.validateCurrency(e)?n.validateShortString(r,!0)?n.validateEventPartLength(s,!1)?n.validateEventPartCharacters(s)?n.validateEventPartLength(o,!1)?!!n.validateEventPartCharacters(o)||(t.i("Validation fail - business event - itemId: Cannot contain other characters than A-z, 0-9, -_., ()!?. String: "+o),!1):(t.i("Validation fail - business event - itemId. Cannot be (null), empty or above 64 characters. String: "+o),!1):(t.i("Validation fail - business event - itemType: Cannot contain other characters than A-z, 0-9, -_., ()!?. String: "+s),!1):(t.i("Validation fail - business event - itemType: Cannot be (null), empty or above 64 characters. String: "+s),!1):(t.i("Validation fail - business event - cartType. Cannot be above 32 length. String: "+r),!1):(t.i("Validation fail - business event - currency: Cannot be (null) and need to be A-Z, 3 characters and in the standard at openexchangerates.org. Failed currency: "+e),!1)},n.validateResourceEvent=function(i,s,o,a,u,c,d){return i==e.EGAResourceFlowType.Undefined?(t.i("Validation fail - resource event - flowType: Invalid flow type."),!1):s?r.stringArrayContainsString(c,s)?o>0?a?n.validateEventPartLength(a,!1)?n.validateEventPartCharacters(a)?r.stringArrayContainsString(d,a)?n.validateEventPartLength(u,!1)?!!n.validateEventPartCharacters(u)||(t.i("Validation fail - resource event - itemId: Cannot contain other characters than A-z, 0-9, -_., ()!?. String: "+u),!1):(t.i("Validation fail - resource event - itemId: Cannot be (null), empty or above 64 characters. String: "+u),!1):(t.i("Validation fail - resource event - itemType: Not found in list of pre-defined available resource itemTypes. String: "+a),!1):(t.i("Validation fail - resource event - itemType: Cannot contain other characters than A-z, 0-9, -_., ()!?. String: "+a),!1):(t.i("Validation fail - resource event - itemType: Cannot be (null), empty or above 64 characters. String: "+a),!1):(t.i("Validation fail - resource event - itemType: Cannot be (null)"),!1):(t.i("Validation fail - resource event - amount: Float amount cannot be 0 or negative. Value: "+o),!1):(t.i("Validation fail - resource event - currency: Not found in list of pre-defined available resource currencies. String: "+s),!1):(t.i("Validation fail - resource event - currency: Cannot be (null)"),!1)},n.validateProgressionEvent=function(i,r,s,o){if(i==e.EGAProgressionStatus.Undefined)return t.i("Validation fail - progression event: Invalid progression status."),!1;if(o&&!s&&r)return t.i("Validation fail - progression event: 03 found but 01+02 are invalid. Progression must be set as either 01, 01+02 or 01+02+03."),!1;if(s&&!r)return t.i("Validation fail - progression event: 02 found but not 01. Progression must be set as either 01, 01+02 or 01+02+03"),!1;if(!r)return t.i("Validation fail - progression event: progression01 not valid. Progressions must be set as either 01, 01+02 or 01+02+03"),!1;if(!n.validateEventPartLength(r,!1))return t.i("Validation fail - progression event - progression01: Cannot be (null), empty or above 64 characters. String: "+r),!1;if(!n.validateEventPartCharacters(r))return t.i("Validation fail - progression event - progression01: Cannot contain other characters than A-z, 0-9, -_., ()!?. String: "+r),!1;if(s){if(!n.validateEventPartLength(s,!0))return t.i("Validation fail - progression event - progression02: Cannot be empty or above 64 characters. String: "+s),!1;if(!n.validateEventPartCharacters(s))return t.i("Validation fail - progression event - progression02: Cannot contain other characters than A-z, 0-9, -_., ()!?. String: "+s),!1}if(o){if(!n.validateEventPartLength(o,!0))return t.i("Validation fail - progression event - progression03: Cannot be empty or above 64 characters. String: "+o),!1;if(!n.validateEventPartCharacters(o))return t.i("Validation fail - progression event - progression03: Cannot contain other characters than A-z, 0-9, -_., ()!?. String: "+o),!1}return!0},n.validateDesignEvent=function(e,i){return n.validateEventIdLength(e)?!!n.validateEventIdCharacters(e)||(t.i("Validation fail - design event - eventId: Non valid characters. Only allowed A-z, 0-9, -_., ()!?. String: "+e),!1):(t.i("Validation fail - design event - eventId: Cannot be (null) or empty. Only 5 event parts allowed seperated by :. Each part need to be 32 characters or less. String: "+e),!1)},n.validateErrorEvent=function(i,r){return i==e.EGAErrorSeverity.Undefined?(t.i("Validation fail - error event - severity: Severity was unsupported value."),!1):!!n.validateLongString(r,!0)||(t.i("Validation fail - error event - message: Message cannot be above 8192 characters."),!1)},n.validateSdkErrorEvent=function(e,r,s){return!!n.validateKeys(e,r)&&(s!==i.Undefined||(t.i("Validation fail - sdk error event - type: Type was unsupported value."),!1))},n.validateKeys=function(e,n){return!(!r.stringMatch(e,/^[A-z0-9]{32}$/)||!r.stringMatch(n,/^[A-z0-9]{40}$/))},n.validateCurrency=function(e){return!!e&&!!r.stringMatch(e,/^[A-Z]{3}$/)},n.validateEventPartLength=function(e,n){return!(!n||e)||!!e&&!(e.length>64)},n.validateEventPartCharacters=function(e){return!!r.stringMatch(e,/^[A-Za-z0-9\s\-_\.\(\)\!\?]{1,64}$/)},n.validateEventIdLength=function(e){return!!e&&!!r.stringMatch(e,/^[^:]{1,64}(?::[^:]{1,64}){0,4}$/)},n.validateEventIdCharacters=function(e){return!!e&&!!r.stringMatch(e,/^[A-Za-z0-9\s\-_\.\(\)\!\?]{1,64}(:[A-Za-z0-9\s\-_\.\(\)\!\?]{1,64}){0,4}$/)},n.validateAndCleanInitRequestResponse=function(e){if(null==e)return t.w("validateInitRequestResponse failed - no response dictionary."),null;var n={};try{n.enabled=e.enabled}catch(e){return t.w("validateInitRequestResponse failed - invalid type in 'enabled' field."),null}try{var i=e.server_ts;if(!(i>0))return t.w("validateInitRequestResponse failed - invalid value in 'server_ts' field."),null;n.server_ts=i}catch(n){return t.w("validateInitRequestResponse failed - invalid type in 'server_ts' field. type="+typeof e.server_ts+", value="+e.server_ts+", "+n),null}return n},n.validateBuild=function(e){return!!n.validateShortString(e,!1)},n.validateSdkWrapperVersion=function(e){return!!r.stringMatch(e,/^(unity|unreal|gamemaker|cocos2d|construct) [0-9]{0,5}(\.[0-9]{0,5}){0,2}$/)},n.validateEngineVersion=function(e){return!(!e||!r.stringMatch(e,/^(unity|unreal|gamemaker|cocos2d|construct) [0-9]{0,5}(\.[0-9]{0,5}){0,2}$/))},n.validateUserId=function(e){return!!n.validateString(e,!1)||(t.i("Validation fail - user id: id cannot be (null), empty or above 64 characters."),!1)},n.validateShortString=function(e,n){return!(!n||e)||!(!e||e.length>32)},n.validateString=function(e,n){return!(!n||e)||!(!e||e.length>64)},n.validateLongString=function(e,n){return!(!n||e)||!(!e||e.length>8192)},n.validateConnectionType=function(e){return r.stringMatch(e,/^(wwan|wifi|lan|offline)$/)},n.validateCustomDimensions=function(e){return n.validateArrayOfStrings(20,32,!1,"custom dimensions",e)},n.validateResourceCurrencies=function(e){if(!n.validateArrayOfStrings(20,64,!1,"resource currencies",e))return!1;for(var i=0;i<e.length;++i)if(!r.stringMatch(e[i],/^[A-Za-z]+$/))return t.i("resource currencies validation failed: a resource currency can only be A-Z, a-z. String was: "+e[i]),!1;return!0},n.validateResourceItemTypes=function(e){if(!n.validateArrayOfStrings(20,32,!1,"resource item types",e))return!1;for(var i=0;i<e.length;++i)if(!n.validateEventPartCharacters(e[i]))return t.i("resource item types validation failed: a resource item type cannot contain other characters than A-z, 0-9, -_., ()!?. String was: "+e[i]),!1;return!0},n.validateDimension01=function(e,n){return!e||!!r.stringArrayContainsString(n,e)},n.validateDimension02=function(e,n){return!e||!!r.stringArrayContainsString(n,e)},n.validateDimension03=function(e,n){return!e||!!r.stringArrayContainsString(n,e)},n.validateArrayOfStrings=function(e,n,i,r,s){var o=r;if(o||(o="Array"),!s)return t.i(o+" validation failed: array cannot be null. "),!1;if(0==i&&0==s.length)return t.i(o+" validation failed: array cannot be empty. "),!1;if(e>0&&s.length>e)return t.i(o+" validation failed: array cannot exceed "+e+" values. It has "+s.length+" values."),!1;for(var a=0;a<s.length;++a){var u=s[a]?s[a].length:0;if(0===u)return t.i(o+" validation failed: contained an empty string. Array="+JSON.stringify(s)),!1;if(n>0&&u>n)return t.i(o+" validation failed: a string exceeded max allowed length (which is: "+n+"). String was: "+s[a]),!1}return!0},n.validateFacebookId=function(e){return!!n.validateString(e,!1)||(t.i("Validation fail - facebook id: id cannot be (null), empty or above 64 characters."),!1)},n.validateGender=function(n){if(isNaN(Number(e.EGAGender[n]))){if(n==e.EGAGender.Undefined||n!=e.EGAGender.Male&&n!=e.EGAGender.Female)return t.i("Validation fail - gender: Has to be 'male' or 'female'. Was: "+n),!1}else if(n==e.EGAGender[e.EGAGender.Undefined]||n!=e.EGAGender[e.EGAGender.Male]&&n!=e.EGAGender[e.EGAGender.Female])return t.i("Validation fail - gender: Has to be 'male' or 'female'. Was: "+n),!1;return!0},n.validateBirthyear=function(e){return!(e<0||e>9999)||(t.i("Validation fail - birthYear: Cannot be (null) or invalid range."),!1)},n.validateClientTs=function(e){return!(e<-4294967294||e>4294967294)},n}();n.GAValidator=s}(e.validators||(e.validators={}))}(ganalyticsxyz||(ganalyticsxyz={}));var ganalyticsxyz;!function(e){!function(e){var n=function(){function e(e,n,t){this.name=e,this.value=n,this.version=t}return e}();e.NameValueVersion=n;var t=function(){function e(e,n){this.name=e,this.version=n}return e}();e.NameVersion=t;var i=function(){function e(){}return e.touch=function(){},e.getRelevantSdkVersion=function(){return e.sdkGameEngineVersion?e.sdkGameEngineVersion:e.sdkWrapperVersion},e.getConnectionType=function(){return e.connectionType},e.updateConnectionType=function(){navigator.onLine?"ios"===e.buildPlatform||"android"===e.buildPlatform?e.connectionType="wwan":e.connectionType="lan":e.connectionType="offline"},e.getOSVersionString=function(){return e.buildPlatform+" "+e.osVersionPair.version},e.runtimePlatformToString=function(){return e.osVersionPair.name},e.getBrowserVersionString=function(){var e,n=navigator.userAgent,t=n.match(/(opera|chrome|safari|firefox|ubrowser|msie|trident(?=\/))\/?\s*(\d+)/i)||[];if(/trident/i.test(t[1]))return e=/\brv[ :]+(\d+)/g.exec(n)||[],"IE "+(e[1]||"");if("Chrome"===t[1]&&null!=(e=n.match(/\b(OPR|Edge|UBrowser)\/(\d+)/)))return e.slice(1).join(" ").replace("OPR","Opera").replace("UBrowser","UC").toLowerCase();var i=t[2]?[t[1],t[2]]:[navigator.appName,navigator.appVersion,"-?"];return null!=(e=n.match(/version\/(\d+)/i))&&i.splice(1,1,e[1]),i.join(" ").toLowerCase()},e.getDeviceModel=function(){return"unknown"},e.getDeviceManufacturer=function(){return"unknown"},e.matchItem=function(e,n){var i,r,s,o,a,u=new t("unknown","0.0.0"),c=0,d=0;for(c=0;c<n.length;c+=1)if(i=new RegExp(n[c].value,"i"),i.test(e)){if(r=new RegExp(n[c].version+"[- /:;]([\\d._]+)","i"),s=e.match(r),a="",s&&s[1]&&(o=s[1]),o){var l=o.split(/[._]+/);for(d=0;d<Math.min(l.length,3);d+=1)a+=l[d]+(d<Math.min(l.length,3)-1?".":"")}else a="0.0.0";return u.name=n[c].name,u.version=a,u}return u},e}();i.sdkWrapperVersion="javascript 2.1.0",i.osVersionPair=i.matchItem([navigator.platform,navigator.userAgent,navigator.appVersion,navigator.vendor,window.opera].join(" "),[new n("windows_phone","Windows Phone","OS"),new n("windows","Win","NT"),new n("ios","iPhone","OS"),new n("ios","iPad","OS"),new n("ios","iPod","OS"),new n("android","Android","Android"),new n("blackBerry","BlackBerry","/"),new n("mac_osx","Mac","OS X"),new n("tizen","Tizen","Tizen"),new n("linux","Linux","rv")]),i.buildPlatform=i.runtimePlatformToString(),i.deviceModel=i.getDeviceModel(),i.deviceManufacturer=i.getDeviceManufacturer(),i.osVersion=i.getOSVersionString(),i.browserVersion=i.getBrowserVersionString(),i.maxSafeInteger=Math.pow(2,53)-1,e.GADevice=i}(e.device||(e.device={}))}(ganalyticsxyz||(ganalyticsxyz={}));var ganalyticsxyz;!function(e){!function(e){var n=function(){function e(n){this.deadline=n,this.ignore=!1,this.async=!1,this.running=!1,this.id=++e.idCounter}return e}();n.idCounter=0,e.TimedBlock=n}(e.threading||(e.threading={}))}(ganalyticsxyz||(ganalyticsxyz={}));var ganalyticsxyz;!function(e){!function(e){var n=function(){function e(e){this.comparer=e,this._subQueues={},this._sortedKeys=[]}return e.prototype.enqueue=function(e,n){-1===this._sortedKeys.indexOf(e)&&this.addQueueOfPriority(e),this._subQueues[e].push(n)},e.prototype.addQueueOfPriority=function(e){var n=this;this._sortedKeys.push(e),this._sortedKeys.sort(function(e,t){return n.comparer.compare(e,t)}),this._subQueues[e]=[]},e.prototype.peek=function(){if(this.hasItems())return this._subQueues[this._sortedKeys[0]][0];throw new Error("The queue is empty")},e.prototype.hasItems=function(){return this._sortedKeys.length>0},e.prototype.dequeue=function(){if(this.hasItems())return this.dequeueFromHighPriorityQueue();throw new Error("The queue is empty")},e.prototype.dequeueFromHighPriorityQueue=function(){var e=this._sortedKeys[0],n=this._subQueues[e].shift();return 0===this._subQueues[e].length&&(this._sortedKeys.shift(),delete this._subQueues[e]),n},e}();e.PriorityQueue=n}(e.threading||(e.threading={}))}(ganalyticsxyz||(ganalyticsxyz={}));var ganalyticsxyz;!function(e){!function(n){var t,i=e.logging.GALogger;!function(e){e[e.Equal=0]="Equal",e[e.LessOrEqual=1]="LessOrEqual",e[e.NotEqual=2]="NotEqual"}(t=n.EGAStoreArgsOperator||(n.EGAStoreArgsOperator={}));var r;!function(e){e[e.Events=0]="Events",e[e.Sessions=1]="Sessions",e[e.Progression=2]="Progression"}(r=n.EGAStore||(n.EGAStore={}));var s=function(){function e(){this.eventsStore=[],this.sessionsStore=[],this.progressionStore=[],this.storeItems={};try{"object"==typeof localStorage?(localStorage.setItem("testingLocalStorage","yes"),localStorage.removeItem("testingLocalStorage"),e.storageAvailable=!0):e.storageAvailable=!1}catch(e){}}return e.isStorageAvailable=function(){return e.storageAvailable},e.isStoreTooLargeForEvents=function(){return e.instance.eventsStore.length+e.instance.sessionsStore.length>e.MaxNumberOfEntries},e.select=function(n,i,r,s){void 0===i&&(i=[]),void 0===r&&(r=!1),void 0===s&&(s=0);var o=e.getStore(n);if(!o)return null;for(var a=[],u=0;u<o.length;++u){for(var c=o[u],d=!0,l=0;l<i.length;++l){var f=i[l];if(c[f[0]])switch(f[1]){case t.Equal:d=c[f[0]]==f[2];break;case t.LessOrEqual:d=c[f[0]]<=f[2];break;case t.NotEqual:d=c[f[0]]!=f[2];break;default:d=!1}else d=!1;if(!d)break}d&&a.push(c)}return r&&a.sort(function(e,n){return e.client_ts-n.client_ts}),s>0&&a.length>s&&(a=a.slice(0,s+1)),a},e.update=function(n,i,r){void 0===r&&(r=[]);var s=e.getStore(n);if(!s)return!1;for(var o=0;o<s.length;++o){for(var a=s[o],u=!0,c=0;c<r.length;++c){var d=r[c];if(a[d[0]])switch(d[1]){case t.Equal:u=a[d[0]]==d[2];break;case t.LessOrEqual:u=a[d[0]]<=d[2];break;case t.NotEqual:u=a[d[0]]!=d[2];break;default:u=!1}else u=!1;if(!u)break}if(u)for(var c=0;c<i.length;++c){var l=i[c];a[l[0]]=l[1]}}return!0},e.delete=function(n,i){var r=e.getStore(n);if(r)for(var s=0;s<r.length;++s){for(var o=r[s],a=!0,u=0;u<i.length;++u){var c=i[u];if(o[c[0]])switch(c[1]){case t.Equal:a=o[c[0]]==c[2];break;case t.LessOrEqual:a=o[c[0]]<=c[2];break;case t.NotEqual:a=o[c[0]]!=c[2];break;default:a=!1}else a=!1;if(!a)break}a&&(r.splice(s,1),--s)}},e.insert=function(n,t,i,r){void 0===i&&(i=!1),void 0===r&&(r=null);var s=e.getStore(n);if(s)if(i){if(!r)return;for(var o=!1,a=0;a<s.length;++a){var u=s[a];if(u[r]==t[r]){for(var c in t)u[c]=t[c];o=!0;break}}o||s.push(t)}else s.push(t)},e.save=function(){if(!e.isStorageAvailable())return void i.w("Storage is not available, cannot save.");localStorage.setItem(e.KeyPrefix+e.EventsStoreKey,JSON.stringify(e.instance.eventsStore)),localStorage.setItem(e.KeyPrefix+e.SessionsStoreKey,JSON.stringify(e.instance.sessionsStore)),localStorage.setItem(e.KeyPrefix+e.ProgressionStoreKey,JSON.stringify(e.instance.progressionStore)),localStorage.setItem(e.KeyPrefix+e.ItemsStoreKey,JSON.stringify(e.instance.storeItems))},e.load=function(){if(!e.isStorageAvailable())return void i.w("Storage is not available, cannot load.");try{e.instance.eventsStore=JSON.parse(localStorage.getItem(e.KeyPrefix+e.EventsStoreKey)),e.instance.eventsStore||(e.instance.eventsStore=[])}catch(n){i.w("Load failed for 'events' store. Using empty store."),e.instance.eventsStore=[]}try{e.instance.sessionsStore=JSON.parse(localStorage.getItem(e.KeyPrefix+e.SessionsStoreKey)),e.instance.sessionsStore||(e.instance.sessionsStore=[])}catch(n){i.w("Load failed for 'sessions' store. Using empty store."),e.instance.sessionsStore=[]}try{e.instance.progressionStore=JSON.parse(localStorage.getItem(e.KeyPrefix+e.ProgressionStoreKey)),e.instance.progressionStore||(e.instance.progressionStore=[])}catch(n){i.w("Load failed for 'progression' store. Using empty store."),e.instance.progressionStore=[]}try{e.instance.storeItems=JSON.parse(localStorage.getItem(e.KeyPrefix+e.ItemsStoreKey)),e.instance.storeItems||(e.instance.storeItems={})}catch(n){i.w("Load failed for 'items' store. Using empty store."),e.instance.progressionStore=[]}},e.setItem=function(n,t){var i=e.KeyPrefix+n;t?e.instance.storeItems[i]=t:i in e.instance.storeItems&&delete e.instance.storeItems[i]},e.getItem=function(n){var t=e.KeyPrefix+n;return t in e.instance.storeItems?e.instance.storeItems[t]:null},e.getStore=function(n){switch(n){case r.Events:return e.instance.eventsStore;case r.Sessions:return e.instance.sessionsStore;case r.Progression:return e.instance.progressionStore;default:return i.w("GAStore.getStore(): Cannot find store: "+n),null}},e}();s.instance=new s,s.MaxNumberOfEntries=2e3,s.KeyPrefix="GA::",s.EventsStoreKey="ga_event",s.SessionsStoreKey="ga_session",s.ProgressionStoreKey="ga_progression",s.ItemsStoreKey="ga_items",n.GAStore=s}(e.store||(e.store={}))}(ganalyticsxyz||(ganalyticsxyz={}));var ganalyticsxyz;!function(e){!function(n){var t=e.validators.GAValidator,i=e.utilities.GAUtilities,r=e.logging.GALogger,s=e.store.GAStore,o=e.device.GADevice,a=e.store.EGAStore,u=e.store.EGAStoreArgsOperator,c=function(){function n(){this.availableCustomDimensions01=[],this.availableCustomDimensions02=[],this.availableCustomDimensions03=[],this.availableResourceCurrencies=[],this.availableResourceItemTypes=[],this.sdkConfigDefault={},this.sdkConfig={},this.progressionTries={}}return n.setUserId=function(e){n.instance.userId=e,n.cacheIdentifier()},n.getIdentifier=function(){return n.instance.identifier},n.isInitialized=function(){return n.instance.initialized},n.setInitialized=function(e){n.instance.initialized=e},n.getSessionStart=function(){return n.instance.sessionStart},n.getSessionNum=function(){return n.instance.sessionNum},n.getTransactionNum=function(){return n.instance.transactionNum},n.getSessionId=function(){return n.instance.sessionId},n.getCurrentCustomDimension01=function(){return n.instance.currentCustomDimension01},n.getCurrentCustomDimension02=function(){return n.instance.currentCustomDimension02},n.getCurrentCustomDimension03=function(){return n.instance.currentCustomDimension03},n.getGameKey=function(){return n.instance.gameKey},n.getGameSecret=function(){return n.instance.gameSecret},n.getAvailableCustomDimensions01=function(){return n.instance.availableCustomDimensions01},n.setAvailableCustomDimensions01=function(e){t.validateCustomDimensions(e)&&(n.instance.availableCustomDimensions01=e,n.validateAndFixCurrentDimensions(),r.i("Set available custom01 dimension values: ("+i.joinStringArray(e,", ")+")"))},n.getAvailableCustomDimensions02=function(){return n.instance.availableCustomDimensions02},n.setAvailableCustomDimensions02=function(e){t.validateCustomDimensions(e)&&(n.instance.availableCustomDimensions02=e,n.validateAndFixCurrentDimensions(),r.i("Set available custom02 dimension values: ("+i.joinStringArray(e,", ")+")"))},n.getAvailableCustomDimensions03=function(){return n.instance.availableCustomDimensions03},n.setAvailableCustomDimensions03=function(e){t.validateCustomDimensions(e)&&(n.instance.availableCustomDimensions03=e,n.validateAndFixCurrentDimensions(),r.i("Set available custom03 dimension values: ("+i.joinStringArray(e,", ")+")"))},n.getAvailableResourceCurrencies=function(){return n.instance.availableResourceCurrencies},n.setAvailableResourceCurrencies=function(e){t.validateResourceCurrencies(e)&&(n.instance.availableResourceCurrencies=e,r.i("Set available resource currencies: ("+i.joinStringArray(e,", ")+")"))},n.getAvailableResourceItemTypes=function(){return n.instance.availableResourceItemTypes},n.setAvailableResourceItemTypes=function(e){t.validateResourceItemTypes(e)&&(n.instance.availableResourceItemTypes=e,r.i("Set available resource item types: ("+i.joinStringArray(e,", ")+")"))},n.getBuild=function(){return n.instance.build},n.setBuild=function(e){n.instance.build=e,r.i("Set build version: "+e)},n.getUseManualSessionHandling=function(){return n.instance.useManualSessionHandling},n.prototype.setDefaultId=function(e){this.defaultUserId=e||"",n.cacheIdentifier()},n.getDefaultId=function(){return n.instance.defaultUserId},n.getSdkConfig=function(){var e,t=0;for(var i in n.instance.sdkConfig)0===t&&(e=i),++t;if(e&&t>0)return n.instance.sdkConfig;var e,t=0;for(var i in n.instance.sdkConfigCached)0===t&&(e=i),++t;return e&&t>0?n.instance.sdkConfigCached:n.instance.sdkConfigDefault},n.isEnabled=function(){var e=n.getSdkConfig()
;return(!e.enabled||"false"!=e.enabled)&&!!n.instance.initAuthorized},n.setCustomDimension01=function(e){n.instance.currentCustomDimension01=e,s.setItem(n.Dimension01Key,e),r.i("Set custom01 dimension value: "+e)},n.setCustomDimension02=function(e){n.instance.currentCustomDimension02=e,s.setItem(n.Dimension02Key,e),r.i("Set custom02 dimension value: "+e)},n.setCustomDimension03=function(e){n.instance.currentCustomDimension03=e,s.setItem(n.Dimension03Key,e),r.i("Set custom03 dimension value: "+e)},n.setFacebookId=function(e){n.instance.facebookId=e,s.setItem(n.FacebookIdKey,e),r.i("Set facebook id: "+e)},n.setGender=function(t){n.instance.gender=isNaN(Number(e.EGAGender[t]))?e.EGAGender[t].toString().toLowerCase():e.EGAGender[e.EGAGender[t]].toString().toLowerCase(),s.setItem(n.GenderKey,n.instance.gender),r.i("Set gender: "+n.instance.gender)},n.setBirthYear=function(e){n.instance.birthYear=e,s.setItem(n.BirthYearKey,e.toString()),r.i("Set birth year: "+e)},n.incrementSessionNum=function(){var e=n.getSessionNum()+1;n.instance.sessionNum=e},n.incrementTransactionNum=function(){var e=n.getTransactionNum()+1;n.instance.transactionNum=e},n.incrementProgressionTries=function(e){var t=n.getProgressionTries(e)+1;n.instance.progressionTries[e]=t;var i={};i.progression=e,i.tries=t,s.insert(a.Progression,i,!0,"progression")},n.getProgressionTries=function(e){return e in n.instance.progressionTries?n.instance.progressionTries[e]:0},n.clearProgressionTries=function(e){e in n.instance.progressionTries&&delete n.instance.progressionTries[e];var t=[];t.push(["progression",u.Equal,e]),s.delete(a.Progression,t)},n.setKeys=function(e,t){n.instance.gameKey=e,n.instance.gameSecret=t},n.setManualSessionHandling=function(e){n.instance.useManualSessionHandling=e,r.i("Use manual session handling: "+e)},n.getEventAnnotations=function(){var e={};e.v=2,e.user_id=n.instance.identifier,e.client_ts=n.getClientTsAdjusted(),e.sdk_version=o.getRelevantSdkVersion(),e.os_version=o.osVersion,e.manufacturer=o.deviceManufacturer,e.device=o.deviceModel,e.browser_version=o.browserVersion,e.platform=o.buildPlatform,e.session_id=n.instance.sessionId,e[n.SessionNumKey]=n.instance.sessionNum;var i=o.getConnectionType();return t.validateConnectionType(i)&&(e.connection_type=i),o.gameEngineVersion&&(e.engine_version=o.gameEngineVersion),n.instance.build&&(e.build=n.instance.build),n.instance.facebookId&&(e[n.FacebookIdKey]=n.instance.facebookId),n.instance.gender&&(e[n.GenderKey]=n.instance.gender),0!=n.instance.birthYear&&(e[n.BirthYearKey]=n.instance.birthYear),e},n.getSdkErrorEventAnnotations=function(){var e={};e.v=2,e.category=n.CategorySdkError,e.sdk_version=o.getRelevantSdkVersion(),e.os_version=o.osVersion,e.manufacturer=o.deviceManufacturer,e.device=o.deviceModel,e.platform=o.buildPlatform;var i=o.getConnectionType();return t.validateConnectionType(i)&&(e.connection_type=i),o.gameEngineVersion&&(e.engine_version=o.gameEngineVersion),e},n.getInitAnnotations=function(){var e={};return e.sdk_version=o.getRelevantSdkVersion(),e.os_version=o.osVersion,e.platform=o.buildPlatform,e},n.getClientTsAdjusted=function(){var e=i.timeIntervalSince1970(),r=e+n.instance.clientServerTimeOffset;return t.validateClientTs(r)?r:e},n.sessionIsStarted=function(){return 0!=n.instance.sessionStart},n.cacheIdentifier=function(){n.instance.userId?n.instance.identifier=n.instance.userId:n.instance.defaultUserId&&(n.instance.identifier=n.instance.defaultUserId)},n.ensurePersistedStates=function(){s.isStorageAvailable()&&s.load();var e=n.instance;e.setDefaultId(null!=s.getItem(n.DefaultUserIdKey)?s.getItem(n.DefaultUserIdKey):i.createGuid()),e.sessionNum=null!=s.getItem(n.SessionNumKey)?Number(s.getItem(n.SessionNumKey)):0,e.transactionNum=null!=s.getItem(n.TransactionNumKey)?Number(s.getItem(n.TransactionNumKey)):0,e.facebookId?s.setItem(n.FacebookIdKey,e.facebookId):(e.facebookId=null!=s.getItem(n.FacebookIdKey)?s.getItem(n.FacebookIdKey):"",e.facebookId),e.gender?s.setItem(n.GenderKey,e.gender):(e.gender=null!=s.getItem(n.GenderKey)?s.getItem(n.GenderKey):"",e.gender),e.birthYear&&0!=e.birthYear?s.setItem(n.BirthYearKey,e.birthYear.toString()):(e.birthYear=null!=s.getItem(n.BirthYearKey)?Number(s.getItem(n.BirthYearKey)):0,e.birthYear),e.currentCustomDimension01?s.setItem(n.Dimension01Key,e.currentCustomDimension01):(e.currentCustomDimension01=null!=s.getItem(n.Dimension01Key)?s.getItem(n.Dimension01Key):"",e.currentCustomDimension01),e.currentCustomDimension02?s.setItem(n.Dimension02Key,e.currentCustomDimension02):(e.currentCustomDimension02=null!=s.getItem(n.Dimension02Key)?s.getItem(n.Dimension02Key):"",e.currentCustomDimension02),e.currentCustomDimension03?s.setItem(n.Dimension03Key,e.currentCustomDimension03):(e.currentCustomDimension03=null!=s.getItem(n.Dimension03Key)?s.getItem(n.Dimension03Key):"",e.currentCustomDimension03);var t=null!=s.getItem(n.SdkConfigCachedKey)?s.getItem(n.SdkConfigCachedKey):"";if(t){var r=JSON.parse(i.decode64(t));r&&(e.sdkConfigCached=r)}var o=s.select(a.Progression);if(o)for(var u=0;u<o.length;++u){var c=o[u];c&&(e.progressionTries[c.progression]=c.tries)}},n.calculateServerTimeOffset=function(e){return e-i.timeIntervalSince1970()},n.validateAndFixCurrentDimensions=function(){t.validateDimension01(n.getCurrentCustomDimension01(),n.getAvailableCustomDimensions01())||n.setCustomDimension01(""),t.validateDimension02(n.getCurrentCustomDimension02(),n.getAvailableCustomDimensions02())||n.setCustomDimension02(""),t.validateDimension03(n.getCurrentCustomDimension03(),n.getAvailableCustomDimensions03())||n.setCustomDimension03("")},n}();c.CategorySdkError="sdk_error",c.instance=new c,c.DefaultUserIdKey="default_user_id",c.SessionNumKey="session_num",c.TransactionNumKey="transaction_num",c.FacebookIdKey="facebook_id",c.GenderKey="gender",c.BirthYearKey="birth_year",c.Dimension01Key="dimension01",c.Dimension02Key="dimension02",c.Dimension03Key="dimension03",c.SdkConfigCachedKey="sdk_config_cached",n.GAState=c}(e.state||(e.state={}))}(ganalyticsxyz||(ganalyticsxyz={}));var ganalyticsxyz;!function(e){!function(n){var t=e.utilities.GAUtilities,i=e.logging.GALogger,r=function(){function e(){}return e.execute=function(n,r,s,o){if(e.countMap[r]||(e.countMap[r]=0),!(e.countMap[r]>=e.MaxCount)){var a=t.getHmac(o,s),u=new XMLHttpRequest;u.onreadystatechange=function(){if(4===u.readyState){if(!u.responseText)return;if(200!=u.status)return void i.w("sdk error failed. response code not 200. status code: "+u.status+", description: "+u.statusText+", body: "+u.responseText);e.countMap[r]=e.countMap[r]+1}},u.open("POST",n,!0),u.setRequestHeader("Content-Type","application/json"),u.setRequestHeader("Authorization",a);try{u.send(s)}catch(e){console.error(e)}}},e}();r.MaxCount=10,r.countMap={},n.SdkErrorTask=r}(e.tasks||(e.tasks={}))}(ganalyticsxyz||(ganalyticsxyz={}));var ganalyticsxyz;!function(e){!function(n){var t=e.state.GAState,i=e.logging.GALogger,r=e.utilities.GAUtilities,s=e.validators.GAValidator,o=e.tasks.SdkErrorTask,a=function(){function e(){this.protocol="https",this.hostName="api.localhost.invalid",this.version="v2",this.baseUrl=this.protocol+"://"+this.hostName+"/"+this.version,this.initializeUrlPath="init",this.eventsUrlPath="events",this.useGzip=!1}return e.prototype.requestInit=function(i){var r=t.getGameKey(),s=this.baseUrl+"/"+r+"/"+this.initializeUrlPath,o=t.getInitAnnotations(),a=JSON.stringify(o);if(!a)return void i(n.EGAHTTPApiResponse.JsonEncodeFailed,null);var u=this.createPayloadData(a,this.useGzip),c=[];c.push(a),e.sendRequest(s,u,c,this.useGzip,e.initRequestCallback,i)},e.prototype.sendEventsInArray=function(i,r,s){if(0!=i.length){var o=t.getGameKey(),a=this.baseUrl+"/"+o+"/"+this.eventsUrlPath,u=JSON.stringify(i);if(!u)return void s(n.EGAHTTPApiResponse.JsonEncodeFailed,null,r,i.length);var c=this.createPayloadData(u,this.useGzip),d=[];d.push(u),d.push(r),d.push(i.length.toString()),e.sendRequest(a,c,d,this.useGzip,e.sendEventInArrayRequestCallback,s)}},e.prototype.sendSdkErrorEvent=function(n){var r=t.getGameKey(),a=t.getGameSecret();if(s.validateSdkErrorEvent(r,a,n)){var u=this.baseUrl+"/"+r+"/"+this.eventsUrlPath,c="",d=t.getSdkErrorEventAnnotations(),l=e.sdkErrorTypeToString(n);d.type=l;var f=[];if(f.push(d),!(c=JSON.stringify(f)))return void i.w("sendSdkErrorEvent: JSON encoding failed.");o.execute(u,n,c,a)}},e.sendEventInArrayRequestCallback=function(t,i,r,s){void 0===s&&(s=null);var o=(s[0],s[1],s[2]),a=parseInt(s[3]),u="",c=0;u=t.responseText,c=t.status;var d=e.instance.processRequestResponse(c,t.statusText,u,"Events");if(d!=n.EGAHTTPApiResponse.Ok&&d!=n.EGAHTTPApiResponse.BadRequest)return void r(d,null,o,a);var l=u?JSON.parse(u):{};if(null==l)return void r(n.EGAHTTPApiResponse.JsonDecodeFailed,null,o,a);n.EGAHTTPApiResponse.BadRequest,r(d,l,o,a)},e.sendRequest=function(e,n,i,s,o,a){var u=new XMLHttpRequest,c=t.getGameSecret(),d=r.getHmac(c,n),l=[];l.push(d);for(var f in i)l.push(i[f]);if(u.onreadystatechange=function(){4===u.readyState&&o(u,e,a,l)},u.open("POST",e,!0),u.setRequestHeader("Content-Type","text/plain"),u.setRequestHeader("Authorization",d),s)throw new Error("gzip not supported");try{u.send(n)}catch(e){console.error(e.stack)}},e.initRequestCallback=function(t,i,r,o){void 0===o&&(o=null);var a=(o[0],o[1],""),u=0;a=t.responseText,u=t.status;var c=a?JSON.parse(a):{},d=e.instance.processRequestResponse(u,t.statusText,a,"Init");if(d!=n.EGAHTTPApiResponse.Ok&&d!=n.EGAHTTPApiResponse.BadRequest)return void r(d,null);if(null==c)return void r(n.EGAHTTPApiResponse.JsonDecodeFailed,null);if(d===n.EGAHTTPApiResponse.BadRequest)return void r(d,null);var l=s.validateAndCleanInitRequestResponse(c);if(!l)return void r(n.EGAHTTPApiResponse.BadResponse,null);r(n.EGAHTTPApiResponse.Ok,l)},e.prototype.createPayloadData=function(e,n){if(n)throw new Error("gzip not supported");return e},e.prototype.processRequestResponse=function(e,t,i,r){return i?200===e?n.EGAHTTPApiResponse.Ok:0===e||401===e?n.EGAHTTPApiResponse.Unauthorized:400===e?n.EGAHTTPApiResponse.BadRequest:500===e?n.EGAHTTPApiResponse.InternalServerError:n.EGAHTTPApiResponse.UnknownResponseCode:n.EGAHTTPApiResponse.NoResponse},e.sdkErrorTypeToString=function(e){switch(e){case n.EGASdkErrorType.Rejected:return"rejected";default:return""}},e}();a.instance=new a,n.GAHTTPApi=a}(e.http||(e.http={}))}(ganalyticsxyz||(ganalyticsxyz={}));var ganalyticsxyz;!function(e){!function(n){var t=e.store.GAStore,i=e.store.EGAStore,r=e.store.EGAStoreArgsOperator,s=e.state.GAState,o=e.logging.GALogger,a=e.utilities.GAUtilities,u=e.http.EGAHTTPApiResponse,c=e.http.GAHTTPApi,d=e.validators.GAValidator,l=e.http.EGASdkErrorType,f=function(){function n(){}return n.addSessionStartEvent=function(){var e={};e.category=n.CategorySessionStart,s.incrementSessionNum(),t.setItem(s.SessionNumKey,s.getSessionNum().toString()),n.addDimensionsToEvent(e),n.addEventToStore(e),o.i("Add SESSION START event"),n.processEvents(n.CategorySessionStart,!1)},n.addSessionEndEvent=function(){var e=s.getSessionStart(),t=s.getClientTsAdjusted(),i=t-e;i<0&&(o.w("Session length was calculated to be less then 0. Should not be possible. Resetting to 0."),i=0);var r={};r.category=n.CategorySessionEnd,r.length=i,n.addDimensionsToEvent(r),n.addEventToStore(r),o.i("Add SESSION END event."),n.processEvents("",!1)},n.addBusinessEvent=function(e,i,r,a,u){if(void 0===u&&(u=null),!d.validateBusinessEvent(e,i,u,r,a))return void c.instance.sendSdkErrorEvent(l.Rejected);var f={};s.incrementTransactionNum(),t.setItem(s.TransactionNumKey,s.getTransactionNum().toString()),f.event_id=r+":"+a,f.category=n.CategoryBusiness,f.currency=e,f.amount=i,f[s.TransactionNumKey]=s.getTransactionNum(),u&&(f.cart_type=u),n.addDimensionsToEvent(f),o.i("Add BUSINESS event: {currency:"+e+", amount:"+i+", itemType:"+r+", itemId:"+a+", cartType:"+u+"}"),n.addEventToStore(f)},n.addResourceEvent=function(t,i,r,a,u){if(!d.validateResourceEvent(t,i,r,a,u,s.getAvailableResourceCurrencies(),s.getAvailableResourceItemTypes()))return void c.instance.sendSdkErrorEvent(l.Rejected);t===e.EGAResourceFlowType.Sink&&(r*=-1);var f={},v=n.resourceFlowTypeToString(t);f.event_id=v+":"+i+":"+a+":"+u,f.category=n.CategoryResource,f.amount=r,n.addDimensionsToEvent(f),o.i("Add RESOURCE event: {currency:"+i+", amount:"+r+", itemType:"+a+", itemId:"+u+"}"),n.addEventToStore(f)},n.addProgressionEvent=function(t,i,r,a,u,f){var v=n.progressionStatusToString(t);if(!d.validateProgressionEvent(t,i,r,a))return void c.instance.sendSdkErrorEvent(l.Rejected);var g,m={};g=r?a?i+":"+r+":"+a:i+":"+r:i,m.category=n.CategoryProgression,m.event_id=v+":"+g;var p=0;f&&t!=e.EGAProgressionStatus.Start&&(m.score=u),t===e.EGAProgressionStatus.Fail&&s.incrementProgressionTries(g),t===e.EGAProgressionStatus.Complete&&(s.incrementProgressionTries(g),p=s.getProgressionTries(g),m.attempt_num=p,s.clearProgressionTries(g)),n.addDimensionsToEvent(m),o.i("Add PROGRESSION event: {status:"+v+", progression01:"+i+", progression02:"+r+", progression03:"+a+", score:"+u+", attempt:"+p+"}"),n.addEventToStore(m)},n.addDesignEvent=function(e,t,i){if(!d.validateDesignEvent(e,t))return void c.instance.sendSdkErrorEvent(l.Rejected);var r={};r.category=n.CategoryDesign,r.event_id=e,i&&(r.value=t),o.i("Add DESIGN event: {eventId:"+e+", value:"+t+"}"),n.addEventToStore(r)},n.addErrorEvent=function(e,t){var i=n.errorSeverityToString(e);if(!d.validateErrorEvent(e,t))return void c.instance.sendSdkErrorEvent(l.Rejected);var r={};r.category=n.CategoryError,r.severity=i,r.message=t,o.i("Add ERROR event: {severity:"+i+", message:"+t+"}"),n.addEventToStore(r)},n.processEvents=function(e,s){try{var u=a.createGuid();s&&(n.cleanupEvents(),n.fixMissingSessionEndEvents());var d=[];d.push(["status",r.Equal,"new"]);var l=[];l.push(["status",r.Equal,"new"]),e&&(d.push(["category",r.Equal,e]),l.push(["category",r.Equal,e]));var f=[];f.push(["status",u]);var v=t.select(i.Events,d);if(!v||0==v.length)return void o.i("Event queue: No events to send");if(v.length>n.MaxEventCount){if(!(v=t.select(i.Events,d,!0,n.MaxEventCount)))return;var g=v[v.length-1],m=g.client_ts;if(d.push(["client_ts",r.LessOrEqual,m]),!(v=t.select(i.Events,d)))return;l.push(["client_ts",r.LessOrEqual,m])}if(o.i("Event queue: Sending "+v.length+" events."),!t.update(i.Events,f,l))return;for(var p=[],h=0;h<v.length;++h){var y=v[h],S=JSON.parse(a.decode64(y.event));0!=S.length&&p.push(S)}c.instance.sendEventsInArray(p,u,n.processEventsCallback)}catch(e){o.e("Error during ProcessEvents(): "+e.stack)}},n.processEventsCallback=function(e,s,a,c){var d=[];if(d.push(["status",r.Equal,a]),e===u.Ok)t.delete(i.Events,d),o.i("Event queue: "+c+" events sent.");else if(e===u.NoResponse){var l=[];l.push(["status","new"]),o.w("Event queue: Failed to send events to collector - Retrying next time"),t.update(i.Events,l,d)}else{if(s){var f,v=0;for(var g in s)0==v&&(f=s[g]),++v;e===u.BadRequest&&f.constructor===Array?o.w("Event queue: "+c+" events sent. "+v+" events failed GA server validation."):o.w("Event queue: Failed to send events.")}else o.w("Event queue: Failed to send events.");t.delete(i.Events,d)}n.updateSessionStore()},n.cleanupEvents=function(){t.update(i.Events,[["status","new"]])},n.fixMissingSessionEndEvents=function(){var e=[];e.push(["session_id",r.NotEqual,s.getSessionId()]);var u=t.select(i.Sessions,e);if(u&&0!=u.length){o.i(u.length+" session(s) located with missing session_end event.");for(var c=0;c<u.length;++c){var d=JSON.parse(a.decode64(u[c].event)),l=d.client_ts,f=u[c].timestamp,v=l-f;v=Math.max(0,v),d.category=n.CategorySessionEnd,d.length=v,n.addEventToStore(d)}}},n.addEventToStore=function(e){if(!s.isInitialized())return void o.w("Could not add event: SDK is not initialized");try{if(t.isStoreTooLargeForEvents()&&!a.stringMatch(e.category,/^(user|session_end|business)$/))return void o.w("Database too large. Event has been blocked.");var u=s.getEventAnnotations(),c=a.encode64(JSON.stringify(u));for(var d in e)u[d]=e[d];var l=JSON.stringify(u);o.ii("Event added to queue: "+l);var f={};f.status="new",f.category=u.category,f.session_id=u.session_id,f.client_ts=u.client_ts,f.event=a.encode64(JSON.stringify(u)),t.insert(i.Events,f),e.category==n.CategorySessionEnd?t.delete(i.Sessions,[["session_id",r.Equal,u.session_id]]):(f={},f.session_id=u.session_id,f.timestamp=s.getSessionStart(),f.event=c,t.insert(i.Sessions,f,!0,"session_id")),t.isStorageAvailable()&&t.save()}catch(d){o.e("addEventToStore: error"),o.e(d.stack)}},n.updateSessionStore=function(){if(s.sessionIsStarted()){var e={};e.session_id=s.instance.sessionId,e.timestamp=s.getSessionStart(),e.event=a.encode64(JSON.stringify(s.getEventAnnotations())),t.insert(i.Sessions,e,!0,"session_id"),t.isStorageAvailable()&&t.save()}},n.addDimensionsToEvent=function(e){e&&(s.getCurrentCustomDimension01()&&(e.custom_01=s.getCurrentCustomDimension01()),s.getCurrentCustomDimension02()&&(e.custom_02=s.getCurrentCustomDimension02()),s.getCurrentCustomDimension03()&&(e.custom_03=s.getCurrentCustomDimension03()))},n.resourceFlowTypeToString=function(n){return n==e.EGAResourceFlowType.Source||n==e.EGAResourceFlowType[e.EGAResourceFlowType.Source]?"Source":n==e.EGAResourceFlowType.Sink||n==e.EGAResourceFlowType[e.EGAResourceFlowType.Sink]?"Sink":""},n.progressionStatusToString=function(n){return n==e.EGAProgressionStatus.Start||n==e.EGAProgressionStatus[e.EGAProgressionStatus.Start]?"Start":n==e.EGAProgressionStatus.Complete||n==e.EGAProgressionStatus[e.EGAProgressionStatus.Complete]?"Complete":n==e.EGAProgressionStatus.Fail||n==e.EGAProgressionStatus[e.EGAProgressionStatus.Fail]?"Fail":""},n.errorSeverityToString=function(n){return n==e.EGAErrorSeverity.Debug||n==e.EGAErrorSeverity[e.EGAErrorSeverity.Debug]?"debug":n==e.EGAErrorSeverity.Info||n==e.EGAErrorSeverity[e.EGAErrorSeverity.Info]?"info":n==e.EGAErrorSeverity.Warning||n==e.EGAErrorSeverity[e.EGAErrorSeverity.Warning]?"warning":n==e.EGAErrorSeverity.Error||n==e.EGAErrorSeverity[e.EGAErrorSeverity.Error]?"error":n==e.EGAErrorSeverity.Critical||n==e.EGAErrorSeverity[e.EGAErrorSeverity.Critical]?"critical":""},n}();f.instance=new f,f.CategorySessionStart="user",f.CategorySessionEnd="session_end",f.CategoryDesign="design",f.CategoryBusiness="business",f.CategoryProgression="progression",f.CategoryResource="resource",f.CategoryError="error",f.MaxEventCount=500,n.GAEvents=f}(e.events||(e.events={}))}(ganalyticsxyz||(ganalyticsxyz={}));var ganalyticsxyz;!function(e){!function(n){var t=e.logging.GALogger,i=e.state.GAState,r=e.events.GAEvents,s=function(){function e(){this.blocks=new n.PriorityQueue({compare:function(e,n){return e-n}}),this.id2TimedBlockMap={},e.startThread()}return e.createTimedBlock=function(e){void 0===e&&(e=0);var t=new Date;return t.setSeconds(t.getSeconds()+e),new n.TimedBlock(t)},e.performTaskOnGAThread=function(t,i){void 0===i&&(i=0);var r=new Date;r.setSeconds(r.getSeconds()+i);var s=new n.TimedBlock(r);s.block=t,e.instance.id2TimedBlockMap[s.id]=s,e.instance.addTimedBlock(s)},e.performTimedBlockOnGAThread=function(n){e.instance.id2TimedBlockMap[n.id]=n,e.instance.addTimedBlock(n)},e.scheduleTimer=function(t,i){var r=new Date;r.setSeconds(r.getSeconds()+t);var s=new n.TimedBlock(r);return s.block=i,e.instance.id2TimedBlockMap[s.id]=s,e.instance.addTimedBlock(s),s.id},e.getTimedBlockById=function(n){return n in e.instance.id2TimedBlockMap?e.instance.id2TimedBlockMap[n]:null},e.ensureEventQueueIsRunning=function(){e.instance.keepRunning=!0,e.instance.isRunning||(e.instance.isRunning=!0,e.scheduleTimer(e.ProcessEventsIntervalInSeconds,e.processEventQueue))},e.endSessionAndStopQueue=function(){i.isInitialized()&&(t.i("Ending session."),e.stopEventQueue(),i.isEnabled()&&i.sessionIsStarted()&&(r.addSessionEndEvent(),i.instance.sessionStart=0))},e.stopEventQueue=function(){e.instance.keepRunning=!1},e.ignoreTimer=function(n){n in e.instance.id2TimedBlockMap&&(e.instance.id2TimedBlockMap[n].ignore=!0)},e.setEventProcessInterval=function(n){n>0&&(e.ProcessEventsIntervalInSeconds=n)},e.prototype.addTimedBlock=function(e){this.blocks.enqueue(e.deadline.getTime(),e)},e.run=function(){clearTimeout(e.runTimeoutId);try{for(var n;n=e.getNextBlock();)if(!n.ignore)if(n.async){if(!n.running){n.running=!0,n.block();break}}else n.block();return void(e.runTimeoutId=setTimeout(e.run,e.ThreadWaitTimeInMs))}catch(e){t.e("Error on GA thread"),t.e(e.stack)}},e.startThread=function(){e.runTimeoutId=setTimeout(e.run,0)},e.getNextBlock=function(){var n=new Date;return e.instance.blocks.hasItems()&&e.instance.blocks.peek().deadline.getTime()<=n.getTime()?e.instance.blocks.peek().async&&e.instance.blocks.peek().running?e.instance.blocks.peek():e.instance.blocks.dequeue():null},e.processEventQueue=function(){r.processEvents("",!0),e.instance.keepRunning?e.scheduleTimer(e.ProcessEventsIntervalInSeconds,e.processEventQueue):e.instance.isRunning=!1},e}();s.instance=new s,s.ThreadWaitTimeInMs=1e3,s.ProcessEventsIntervalInSeconds=8,n.GAThreading=s}(e.threading||(e.threading={}))}(ganalyticsxyz||(ganalyticsxyz={}));var ganalyticsxyz;!function(e){var n=e.threading.GAThreading,t=e.logging.GALogger,i=e.store.GAStore,r=e.state.GAState,s=e.http.GAHTTPApi,o=e.device.GADevice,a=e.validators.GAValidator,u=e.http.EGAHTTPApiResponse,c=e.utilities.GAUtilities,d=e.events.GAEvents,l=function(){function l(){}return l.init=function(){if(o.touch(),l.methodMap.configureAvailableCustomDimensions01=l.configureAvailableCustomDimensions01,l.methodMap.configureAvailableCustomDimensions02=l.configureAvailableCustomDimensions02,l.methodMap.configureAvailableCustomDimensions03=l.configureAvailableCustomDimensions03,l.methodMap.configureAvailableResourceCurrencies=l.configureAvailableResourceCurrencies,l.methodMap.configureAvailableResourceItemTypes=l.configureAvailableResourceItemTypes,l.methodMap.configureBuild=l.configureBuild,l.methodMap.configureSdkGameEngineVersion=l.configureSdkGameEngineVersion,l.methodMap.configureGameEngineVersion=l.configureGameEngineVersion,l.methodMap.configureUserId=l.configureUserId,l.methodMap.initialize=l.initialize,l.methodMap.addBusinessEvent=l.addBusinessEvent,l.methodMap.addResourceEvent=l.addResourceEvent,l.methodMap.addProgressionEvent=l.addProgressionEvent,l.methodMap.addDesignEvent=l.addDesignEvent,l.methodMap.addErrorEvent=l.addErrorEvent,l.methodMap.addErrorEvent=l.addErrorEvent,l.methodMap.setEnabledInfoLog=l.setEnabledInfoLog,l.methodMap.setEnabledVerboseLog=l.setEnabledVerboseLog,l.methodMap.setEnabledManualSessionHandling=l.setEnabledManualSessionHandling,l.methodMap.setCustomDimension01=l.setCustomDimension01,l.methodMap.setCustomDimension02=l.setCustomDimension02,l.methodMap.setCustomDimension03=l.setCustomDimension03,l.methodMap.setFacebookId=l.setFacebookId,l.methodMap.setGender=l.setGender,l.methodMap.setBirthYear=l.setBirthYear,l.methodMap.setEventProcessInterval=l.setEventProcessInterval,l.methodMap.startSession=l.startSession,l.methodMap.endSession=l.endSession,l.methodMap.onStop=l.onStop,l.methodMap.onResume=l.onResume,"undefined"!=typeof window&&void 0!==window.Ganalyticsxyz&&void 0!==window.Ganalyticsxyz.q){var e=window.Ganalyticsxyz.q;for(var n in e)l.gaCommand.apply(null,e[n])}},l.gaCommand=function(){for(var n=[],t=0;t<arguments.length;t++)n[t]=arguments[t];n.length>0&&n[0]in e.Ganalyticsxyz.methodMap&&(n.length>1?e.Ganalyticsxyz.methodMap[n[0]].apply(null,Array.prototype.slice.call(n,1)):e.Ganalyticsxyz.methodMap[n[0]]())},l.configureAvailableCustomDimensions01=function(e){void 0===e&&(e=[]),n.performTaskOnGAThread(function(){if(l.isSdkReady(!0,!1))return void t.w("Available custom dimensions must be set before SDK is initialized");r.setAvailableCustomDimensions01(e)})},l.configureAvailableCustomDimensions02=function(e){void 0===e&&(e=[]),n.performTaskOnGAThread(function(){if(l.isSdkReady(!0,!1))return void t.w("Available custom dimensions must be set before SDK is initialized");r.setAvailableCustomDimensions02(e)})},l.configureAvailableCustomDimensions03=function(e){void 0===e&&(e=[]),n.performTaskOnGAThread(function(){if(l.isSdkReady(!0,!1))return void t.w("Available custom dimensions must be set before SDK is initialized");r.setAvailableCustomDimensions03(e)})},l.configureAvailableResourceCurrencies=function(e){void 0===e&&(e=[]),n.performTaskOnGAThread(function(){if(l.isSdkReady(!0,!1))return void t.w("Available resource currencies must be set before SDK is initialized");r.setAvailableResourceCurrencies(e)})},l.configureAvailableResourceItemTypes=function(e){void 0===e&&(e=[]),n.performTaskOnGAThread(function(){if(l.isSdkReady(!0,!1))return void t.w("Available resource item types must be set before SDK is initialized");r.setAvailableResourceItemTypes(e)})},l.configureBuild=function(e){void 0===e&&(e=""),n.performTaskOnGAThread(function(){return l.isSdkReady(!0,!1)?void t.w("Build version must be set before SDK is initialized."):a.validateBuild(e)?void r.setBuild(e):void t.i("Validation fail - configure build: Cannot be null, empty or above 32 length. String: "+e)})},l.configureSdkGameEngineVersion=function(e){void 0===e&&(e=""),n.performTaskOnGAThread(function(){if(!l.isSdkReady(!0,!1))return a.validateSdkWrapperVersion(e)?void(o.sdkGameEngineVersion=e):void t.i("Validation fail - configure sdk version: Sdk version not supported. String: "+e)})},l.configureGameEngineVersion=function(e){void 0===e&&(e=""),n.performTaskOnGAThread(function(){if(!l.isSdkReady(!0,!1))return a.validateEngineVersion(e)?void(o.gameEngineVersion=e):void t.i("Validation fail - configure game engine version: Game engine version not supported. String: "+e)})},l.configureUserId=function(e){void 0===e&&(e=""),n.performTaskOnGAThread(function(){return l.isSdkReady(!0,!1)?void t.w("A custom user id must be set before SDK is initialized."):a.validateUserId(e)?void r.setUserId(e):void t.i("Validation fail - configure user_id: Cannot be null, empty or above 64 length. Will use default user_id method. Used string: "+e)})},l.initialize=function(e,i){void 0===e&&(e=""),void 0===i&&(i=""),o.updateConnectionType();var s=n.createTimedBlock();s.async=!0,l.initTimedBlockId=s.id,s.block=function(){return l.isSdkReady(!0,!1)?void t.w("SDK already initialized. Can only be called once."):a.validateKeys(e,i)?(r.setKeys(e,i),void l.internalInitialize()):void t.w("SDK failed initialize. Game key or secret key is invalid. Can only contain characters A-z 0-9, gameKey is 32 length, gameSecret is 40 length. Failed keys - gameKey: "+e+", secretKey: "+i)},n.performTimedBlockOnGAThread(s)},l.addBusinessEvent=function(e,t,i,r,s){void 0===e&&(e=""),void 0===t&&(t=0),void 0===i&&(i=""),void 0===r&&(r=""),void 0===s&&(s=""),o.updateConnectionType(),n.performTaskOnGAThread(function(){l.isSdkReady(!0,!0,"Could not add business event")&&d.addBusinessEvent(e,t,i,r,s)})},l.addResourceEvent=function(t,i,r,s,a){void 0===t&&(t=e.EGAResourceFlowType.Undefined),void 0===i&&(i=""),void 0===r&&(r=0),void 0===s&&(s=""),void 0===a&&(a=""),o.updateConnectionType(),n.performTaskOnGAThread(function(){l.isSdkReady(!0,!0,"Could not add resource event")&&d.addResourceEvent(t,i,r,s,a)})},l.addProgressionEvent=function(t,i,r,s,a){void 0===t&&(t=e.EGAProgressionStatus.Undefined),void 0===i&&(i=""),void 0===r&&(r=""),void 0===s&&(s=""),o.updateConnectionType(),n.performTaskOnGAThread(function(){if(l.isSdkReady(!0,!0,"Could not add progression event")){var e=void 0!==a;d.addProgressionEvent(t,i,r,s,e?a:0,e)}})},l.addDesignEvent=function(e,t){o.updateConnectionType(),n.performTaskOnGAThread(function(){if(l.isSdkReady(!0,!0,"Could not add design event")){var n=void 0!==t;d.addDesignEvent(e,n?t:0,n)}})},l.addErrorEvent=function(t,i){void 0===t&&(t=e.EGAErrorSeverity.Undefined),void 0===i&&(i=""),o.updateConnectionType(),n.performTaskOnGAThread(function(){l.isSdkReady(!0,!0,"Could not add error event")&&d.addErrorEvent(t,i)})},l.setEnabledInfoLog=function(e){void 0===e&&(e=!1),n.performTaskOnGAThread(function(){e?(t.setInfoLog(e),t.i("Info logging enabled")):(t.i("Info logging disabled"),t.setInfoLog(e))})},l.setEnabledVerboseLog=function(e){void 0===e&&(e=!1),n.performTaskOnGAThread(function(){e?(t.setVerboseLog(e),t.i("Verbose logging enabled")):(t.i("Verbose logging disabled"),t.setVerboseLog(e))})},l.setEnabledManualSessionHandling=function(e){void 0===e&&(e=!1),n.performTaskOnGAThread(function(){r.setManualSessionHandling(e)})},l.setCustomDimension01=function(e){void 0===e&&(e=""),n.performTaskOnGAThread(function(){if(!a.validateDimension01(e,r.getAvailableCustomDimensions01()))return void t.w("Could not set custom01 dimension value to '"+e+"'. Value not found in available custom01 dimension values");r.setCustomDimension01(e)})},l.setCustomDimension02=function(e){void 0===e&&(e=""),n.performTaskOnGAThread(function(){if(!a.validateDimension02(e,r.getAvailableCustomDimensions02()))return void t.w("Could not set custom02 dimension value to '"+e+"'. Value not found in available custom02 dimension values");r.setCustomDimension02(e)})},l.setCustomDimension03=function(e){void 0===e&&(e=""),n.performTaskOnGAThread(function(){if(!a.validateDimension03(e,r.getAvailableCustomDimensions03()))return void t.w("Could not set custom03 dimension value to '"+e+"'. Value not found in available custom03 dimension values");r.setCustomDimension03(e)})},l.setFacebookId=function(e){void 0===e&&(e=""),n.performTaskOnGAThread(function(){a.validateFacebookId(e)&&r.setFacebookId(e)})},l.setGender=function(t){void 0===t&&(t=e.EGAGender.Undefined),n.performTaskOnGAThread(function(){a.validateGender(t)&&r.setGender(t)})},l.setBirthYear=function(e){void 0===e&&(e=0),n.performTaskOnGAThread(function(){a.validateBirthyear(e)&&r.setBirthYear(e)})},l.setEventProcessInterval=function(e){n.performTaskOnGAThread(function(){n.setEventProcessInterval(e)})},l.startSession=function(){if(r.getUseManualSessionHandling()){if(!r.isInitialized())return;var e=n.createTimedBlock();e.async=!0,l.initTimedBlockId=e.id,e.block=function(){r.isEnabled()&&r.sessionIsStarted()&&n.endSessionAndStopQueue(),l.resumeSessionAndStartQueue()},n.performTimedBlockOnGAThread(e)}},l.endSession=function(){r.getUseManualSessionHandling()&&l.onStop()},l.onStop=function(){n.performTaskOnGAThread(function(){try{n.endSessionAndStopQueue()}catch(e){}})},l.onResume=function(){var e=n.createTimedBlock();e.async=!0,l.initTimedBlockId=e.id,e.block=function(){l.resumeSessionAndStartQueue()},n.performTimedBlockOnGAThread(e)},l.internalInitialize=function(){r.ensurePersistedStates(),i.setItem(r.DefaultUserIdKey,r.getDefaultId()),r.setInitialized(!0),l.newSession(),r.isEnabled()&&n.ensureEventQueueIsRunning()},l.newSession=function(){t.i("Starting a new session."),r.validateAndFixCurrentDimensions(),s.instance.requestInit(l.startNewSessionCallback)},l.startNewSessionCallback=function(e,s){if(e===u.Ok&&s){var o=0;if(s.server_ts){var a=s.server_ts;o=r.calculateServerTimeOffset(a)}s.time_offset=o,i.setItem(r.SdkConfigCachedKey,c.encode64(JSON.stringify(s))),r.instance.sdkConfigCached=s,r.instance.sdkConfig=s,r.instance.initAuthorized=!0}else e==u.Unauthorized?(t.w("Initialize SDK failed - Unauthorized"),r.instance.initAuthorized=!1):(e===u.NoResponse||e===u.RequestTimeout?t.i("Init call (session start) failed - no response. Could be offline or timeout."):e===u.BadResponse||e===u.JsonEncodeFailed||e===u.JsonDecodeFailed?t.i("Init call (session start) failed - bad response. Could be bad response from proxy or GA servers."):e!==u.BadRequest&&e!==u.UnknownResponseCode||t.i("Init call (session start) failed - bad request or unknown response."),null==r.instance.sdkConfig?null!=r.instance.sdkConfigCached?(t.i("Init call (session start) failed - using cached init values."),r.instance.sdkConfig=r.instance.sdkConfigCached):(t.i("Init call (session start) failed - using default init values."),r.instance.sdkConfig=r.instance.sdkConfigDefault):t.i("Init call (session start) failed - using cached init values."),r.instance.initAuthorized=!0)
;if(r.instance.clientServerTimeOffset=r.instance.sdkConfig.time_offset?r.instance.sdkConfig.time_offset:0,!r.isEnabled())return t.w("Could not start session: SDK is disabled."),void n.stopEventQueue();n.ensureEventQueueIsRunning();var f=c.createGuid();r.instance.sessionId=f,r.instance.sessionStart=r.getClientTsAdjusted(),d.addSessionStartEvent(),n.getTimedBlockById(l.initTimedBlockId).running=!1,l.initTimedBlockId=-1},l.resumeSessionAndStartQueue=function(){r.isInitialized()&&(t.i("Resuming session."),r.sessionIsStarted()||l.newSession())},l.isSdkReady=function(e,n,i){return void 0===n&&(n=!0),void 0===i&&(i=""),i&&(i+=": "),e&&!r.isInitialized()?(n&&t.w(i+"SDK is not initialized"),!1):!(e&&!r.isEnabled())||(n&&t.w(i+"SDK is disabled"),!1)},l}();l.initTimedBlockId=-1,l.methodMap={},e.Ganalyticsxyz=l}(ganalyticsxyz||(ganalyticsxyz={})),ganalyticsxyz.Ganalyticsxyz.init();var Ganalyticsxyz=ganalyticsxyz.Ganalyticsxyz.gaCommand;
scope.ganalyticsxyz=ganalyticsxyz;
scope.Ganalyticsxyz=Ganalyticsxyz;
})(this);
/* global define, module, require */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['crypto-js', 'ws'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node. Export.
        module.exports = factory(require('crypto-js'), require('ws'));
    } else {
        // Browser globals (root is window)
        root.GameSparks = factory(root.Crypto, root.WebSocket || root.MozWebSocket);
    }
}(this, function(CryptoJS, WebSocket) {

    var GameSparks = function() {};

    GameSparks.prototype = {

        init: function(options) {
            this.options = options;
            this.socketUrl = options.url;

            this.pendingRequests = {};
            this.requestCounter = 0;

            this.connect();
        },

        initPreview: function(options) {
            options.url = 'wss://preview.gamesparks.net/ws/' + options.key;
            this.init(options);
        },

        initLive: function(options) {
            options.url = 'wss://service.gamesparks.net/ws/' + options.key;
            this.init(options);
        },

        reset: function() {
            this.initialised = false;
            this.connected = false;
            this.error = false;
            this.disconnected = false;

            if (this.webSocket != null){
                this.webSocket.onclose = null;
                this.webSocket.close();
            }
        },

        connect: function() {
            this.reset();

            try {
                this.webSocket = new WebSocket(this.socketUrl);
                this.webSocket.onopen = this.onWebSocketOpen.bind(this);
                this.webSocket.onclose = this.onWebSocketClose.bind(this);
                this.webSocket.onerror = this.onWebSocketError.bind(this);
                this.webSocket.onmessage = this.onWebSocketMessage.bind(this);
            } catch(e) {
                this.log(e.message);
            }
        },

        disconnect: function() {
            if (this.webSocket && this.connected) {
                this.disconnected = true;
                this.webSocket.close();
            }
        },

        onWebSocketOpen: function(ev) {
            this.log('WebSocket onOpen');

            if (this.options.onOpen) {
                this.options.onOpen(ev);
            }

            this.connected = true;
        },

        onWebSocketClose: function(ev) {
            this.log('WebSocket onClose');

            if (this.options.onClose) {
                this.options.onClose(ev);
            }

            this.connected = false;

            // Attemp a re-connection if not in error state or deliberately disconnected.
            if (!this.error && !this.disconnected) {
                this.connect();
            }
        },

        onWebSocketError: function(ev) {

            this.log('WebSocket onError: Sorry, but there is some problem with your socket or the server is down');

            if (this.options.onError) {
                this.options.onError(ev);
            }

            // Reset the socketUrl to the original.
            this.socketUrl = this.options.url;

            this.error = true;
        },

        onWebSocketMessage: function(message) {
            this.log('WebSocket onMessage: ' + message.data);

            var result;
            try {
                result = JSON.parse(message.data);
            } catch (e) {
                this.log('An error ocurred while parsing the JSON Data: ' + message + '; Error: ' + e);
                return;
            }

            if (this.options.onMessage) {
                this.options.onMessage(result);
            }

            // Extract any auth token.
            if (result['authToken']) {
                this.authToken = result['authToken'];
                delete result['authToken'];
            }

            if (result['connectUrl']) {
                // Any time a connectUrl is in the response we should update and reconnect.
                this.socketUrl = result['connectUrl'];
                this.connect();
            }

            var resultType = result['@class'];

            if (resultType === '.AuthenticatedConnectResponse') {
                this.handshake(result);
            } else if (resultType.match(/Response$/)){
                if (result['requestId']) {
                    var requestId = result['requestId'];
                    delete result['requestId'];

                    if (this.pendingRequests[requestId]) {
                        this.pendingRequests[requestId](result);
                        this.pendingRequests[requestId] = null;
                    }
                }
            }

        },

        handshake: function(result) {

            if (result['nonce']) {

                var hmac;

                if (this.options["onNonce"]) {
                    hmac = this.options.onNonce(result['nonce']);
                } else {
                    hmac = window.Crypto.enc.Base64.stringify(window.Crypto.HmacSHA256(result['nonce'], this.options.secret));
                }

                var toSend = {
                    '@class' : '.AuthenticatedConnectRequest',
                    hmac : hmac
                };

                if (this.authToken) {
                    toSend.authToken = this.authToken;
                }

                if (this.sessionId) {
                    toSend.sessionId = this.sessionId;
                }

                const browserData = this.getBrowserData();
                toSend.platform = browserData.browser;
                toSend.os = browserData.operatingSystem;

                this.webSocketSend(toSend);

            } else if (result['sessionId']) {
                this.sessionId = result['sessionId'];
                this.initialised = true;

                if (this.options.onInit) {
                    this.options.onInit();
                }

                this.keepAliveInterval = window.setInterval(this.keepAlive.bind(this), 30000);
            }
        },

        keepAlive: function() {
            if (this.initialised && this.connected) {
                this.webSocket.send(' ');
            }
        },

        send: function(requestType, onResponse){
            this.sendWithData(requestType, {}, onResponse);
        },

        sendWithData: function(requestType, json, onResponse) {
            if (!this.initialised) {
                onResponse({ error: 'NOT_INITIALISED' });
                return;
            }

            // Ensure requestType starts with a dot.
            if (requestType.indexOf('.') !== 0) {
                requestType = '.' + requestType;
            }

            json['@class'] = requestType;

            json.requestId = (new Date()).getTime() + "_" + (++this.requestCounter);

            if (onResponse != null) {
                this.pendingRequests[json.requestId] = onResponse;
                // Time out handler.
                setTimeout((function() {
                    if (this.pendingRequests[json.requestId]) {
                        this.pendingRequests[json.requestId]({ error: 'NO_RESPONSE' });
                    }
                }).bind(this), 32000);
            }

            this.webSocketSend(json);
        },

        webSocketSend: function(data) {

            if (this.options.onSend) {
                this.options.onSend(data);
            }

            var requestString = JSON.stringify(data);
            this.log('WebSocket send: ' + requestString);
            this.webSocket.send(requestString);
        },

        getSocketUrl: function() {
            return this.socketUrl;
        },

        getSessionId: function() {
            return this.sessionId;
        },

        getAuthToken: function() {
            return this.authToken;
        },

        setAuthToken: function(authToken) {
            this.authToken = authToken;
        },

        isConnected: function() {
            return this.connected;
        },

        log: function(message) {
            if (this.options.logger) {
                this.options.logger(message);
            }
        },

        getBrowserData: function() {

            var browsers = [
                {
                    string: navigator.userAgent,
                    subString: 'Chrome',
                    identity: 'Chrome'
                },
                {   string: navigator.userAgent,
                    subString: 'OmniWeb',
                    versionSearch: 'OmniWeb/',
                    identity: 'OmniWeb'
                },
                {
                    string: navigator.vendor,
                    subString: 'Apple',
                    identity: 'Safari',
                    versionSearch: 'Version'
                },
                {
                    prop: window.opera,
                    identity: 'Opera',
                    versionSearch: 'Version'
                },
                {
                    string: navigator.vendor,
                    subString: 'iCab',
                    identity: 'iCab'
                },
                {
                    string: navigator.vendor,
                    subString: 'KDE',
                    identity: 'Konqueror'
                },
                {
                    string: navigator.userAgent,
                    subString: 'Firefox',
                    identity: 'Firefox'
                },
                {
                    string: navigator.vendor,
                    subString: 'Camino',
                    identity: 'Camino'
                },
                {
                    string: navigator.userAgent,
                    subString: 'Netscape',
                    identity: 'Netscape'
                },
                {
                    string: navigator.userAgent,
                    subString: 'MSIE',
                    identity: 'Explorer',
                    versionSearch: 'MSIE'
                },
                {
                    string: navigator.userAgent,
                    subString: 'Gecko',
                    identity: 'Mozilla',
                    versionSearch: 'rv'
                },
                {
                    string: navigator.userAgent,
                    subString: 'Mozilla',
                    identity: 'Netscape',
                    versionSearch: 'Mozilla'
                }
            ];

            var operatingSystems = [
                {
                    string: navigator.platform,
                    subString: 'Win',
                    identity: 'Windows'
                },
                {
                    string: navigator.platform,
                    subString: 'Mac',
                    identity: 'Mac'
                },
                {
                    string: navigator.userAgent,
                    subString: 'iPhone',
                    identity: 'iPhone/iPod'
                },
                {
                    string: navigator.platform,
                    subString: 'Linux',
                    identity: 'Linux'
                }
            ];

            function searchForIdentity(data) {
                for (var i = 0; i < data.length; i++) {
                    var string = data[i].string;
                    var prop = data[i].prop;

                    if (string) {
                        // Look for the sub string in the string.
                        if (string.indexOf(data[i].subString) !== -1) {
                            return data[i].identity;
                        }
                    } else if (prop) {
                        return data[i].identity;
                    }
                }
            }

            return {
                browser: searchForIdentity(browsers),
                operatingSystem: searchForIdentity(operatingSystems)
            };
        }
    };

    return GameSparks;

}));

//var GameSparks = function() {};
GameSparks.prototype.acceptChallengeRequest = function(challengeInstanceId, message, onResponse )
{
    var request = {};
    request["challengeInstanceId"] = challengeInstanceId;
    request["message"] = message;
    gamesparks.sendWithData("AcceptChallengeRequest", request, onResponse);
}
GameSparks.prototype.accountDetailsRequest = function(onResponse )
{
    var request = {};
    gamesparks.sendWithData("AccountDetailsRequest", request, onResponse);
}
GameSparks.prototype.analyticsRequest = function(data, end, key, start, onResponse )
{
    var request = {};
    request["data"] = data;
    request["end"] = end;
    request["key"] = key;
    request["start"] = start;
    gamesparks.sendWithData("AnalyticsRequest", request, onResponse);
}
GameSparks.prototype.aroundMeLeaderboardRequest = function(count, friendIds, leaderboardShortCode, social, onResponse )
{
    var request = {};
    request["count"] = count;
    request["friendIds"] = friendIds;
    request["leaderboardShortCode"] = leaderboardShortCode;
    request["social"] = social;
    gamesparks.sendWithData("AroundMeLeaderboardRequest", request, onResponse);
}
GameSparks.prototype.authenticationRequest = function(password, userName, onResponse )
{
    var request = {};
    request["password"] = password;
    request["userName"] = userName;
    gamesparks.sendWithData("AuthenticationRequest", request, onResponse);
}
GameSparks.prototype.buyVirtualGoodsRequest = function(currencyType, quantity, shortCode, onResponse )
{
    var request = {};
    request["currencyType"] = currencyType;
    request["quantity"] = quantity;
    request["shortCode"] = shortCode;
    gamesparks.sendWithData("BuyVirtualGoodsRequest", request, onResponse);
}
GameSparks.prototype.changeUserDetailsRequest = function(displayName, onResponse )
{
    var request = {};
    request["displayName"] = displayName;
    gamesparks.sendWithData("ChangeUserDetailsRequest", request, onResponse);
}
GameSparks.prototype.chatOnChallengeRequest = function(challengeInstanceId, message, onResponse )
{
    var request = {};
    request["challengeInstanceId"] = challengeInstanceId;
    request["message"] = message;
    gamesparks.sendWithData("ChatOnChallengeRequest", request, onResponse);
}
GameSparks.prototype.consumeVirtualGoodRequest = function(quantity, shortCode, onResponse )
{
    var request = {};
    request["quantity"] = quantity;
    request["shortCode"] = shortCode;
    gamesparks.sendWithData("ConsumeVirtualGoodRequest", request, onResponse);
}
GameSparks.prototype.createChallengeRequest = function(accessType, challengeMessage, challengeShortCode, currency1Wager, currency2Wager, currency3Wager, currency4Wager, currency5Wager, currency6Wager, endTime, expiryTime, maxAttempts, maxPlayers, minPlayers, silent, startTime, usersToChallenge, onResponse )
{
    var request = {};
    request["accessType"] = accessType;
    request["challengeMessage"] = challengeMessage;
    request["challengeShortCode"] = challengeShortCode;
    request["currency1Wager"] = currency1Wager;
    request["currency2Wager"] = currency2Wager;
    request["currency3Wager"] = currency3Wager;
    request["currency4Wager"] = currency4Wager;
    request["currency5Wager"] = currency5Wager;
    request["currency6Wager"] = currency6Wager;
    request["endTime"] = endTime;
    request["expiryTime"] = expiryTime;
    request["maxAttempts"] = maxAttempts;
    request["maxPlayers"] = maxPlayers;
    request["minPlayers"] = minPlayers;
    request["silent"] = silent;
    request["startTime"] = startTime;
    request["usersToChallenge"] = usersToChallenge;
    gamesparks.sendWithData("CreateChallengeRequest", request, onResponse);
}
GameSparks.prototype.declineChallengeRequest = function(challengeInstanceId, message, onResponse )
{
    var request = {};
    request["challengeInstanceId"] = challengeInstanceId;
    request["message"] = message;
    gamesparks.sendWithData("DeclineChallengeRequest", request, onResponse);
}
GameSparks.prototype.deviceAuthenticationRequest = function(deviceId, deviceModel, deviceName, deviceOS, deviceType, operatingSystem, onResponse )
{
    var request = {};
    request["deviceId"] = deviceId;
    request["deviceModel"] = deviceModel;
    request["deviceName"] = deviceName;
    request["deviceOS"] = deviceOS;
    request["deviceType"] = deviceType;
    request["operatingSystem"] = operatingSystem;
    gamesparks.sendWithData("DeviceAuthenticationRequest", request, onResponse);
}
GameSparks.prototype.dismissMessageRequest = function(messageId, onResponse )
{
    var request = {};
    request["messageId"] = messageId;
    gamesparks.sendWithData("DismissMessageRequest", request, onResponse);
}
GameSparks.prototype.endSessionRequest = function(onResponse )
{
    var request = {};
    gamesparks.sendWithData("EndSessionRequest", request, onResponse);
}
GameSparks.prototype.facebookConnectRequest = function(accessToken, code, onResponse )
{
    var request = {};
    request["accessToken"] = accessToken;
    request["code"] = code;
    gamesparks.sendWithData("FacebookConnectRequest", request, onResponse);
}
GameSparks.prototype.findChallengeRequest = function(accessType, count, offset, onResponse )
{
    var request = {};
    request["accessType"] = accessType;
    request["count"] = count;
    request["offset"] = offset;
    gamesparks.sendWithData("FindChallengeRequest", request, onResponse);
}
GameSparks.prototype.getChallengeRequest = function(challengeInstanceId, message, onResponse )
{
    var request = {};
    request["challengeInstanceId"] = challengeInstanceId;
    request["message"] = message;
    gamesparks.sendWithData("GetChallengeRequest", request, onResponse);
}
GameSparks.prototype.getDownloadableRequest = function(shortCode, onResponse )
{
    var request = {};
    request["shortCode"] = shortCode;
    gamesparks.sendWithData("GetDownloadableRequest", request, onResponse);
}
GameSparks.prototype.getMessageRequest = function(messageId, onResponse )
{
    var request = {};
    request["messageId"] = messageId;
    gamesparks.sendWithData("GetMessageRequest", request, onResponse);
}
GameSparks.prototype.getRunningTotalsRequest = function(friendIds, shortCode, onResponse )
{
    var request = {};
    request["friendIds"] = friendIds;
    request["shortCode"] = shortCode;
    gamesparks.sendWithData("GetRunningTotalsRequest", request, onResponse);
}
GameSparks.prototype.getUploadUrlRequest = function(uploadData, onResponse )
{
    var request = {};
    request["uploadData"] = uploadData;
    gamesparks.sendWithData("GetUploadUrlRequest", request, onResponse);
}
GameSparks.prototype.getUploadedRequest = function(uploadId, onResponse )
{
    var request = {};
    request["uploadId"] = uploadId;
    gamesparks.sendWithData("GetUploadedRequest", request, onResponse);
}
GameSparks.prototype.googlePlayBuyGoodsRequest = function(currencyCode, signature, signedData, subUnitPrice, onResponse )
{
    var request = {};
    request["currencyCode"] = currencyCode;
    request["signature"] = signature;
    request["signedData"] = signedData;
    request["subUnitPrice"] = subUnitPrice;
    gamesparks.sendWithData("GooglePlayBuyGoodsRequest", request, onResponse);
}
GameSparks.prototype.iOSBuyGoodsRequest = function(currencyCode, receipt, sandbox, subUnitPrice, onResponse )
{
    var request = {};
    request["currencyCode"] = currencyCode;
    request["receipt"] = receipt;
    request["sandbox"] = sandbox;
    request["subUnitPrice"] = subUnitPrice;
    gamesparks.sendWithData("IOSBuyGoodsRequest", request, onResponse);
}
GameSparks.prototype.joinChallengeRequest = function(challengeInstanceId, message, onResponse )
{
    var request = {};
    request["challengeInstanceId"] = challengeInstanceId;
    request["message"] = message;
    gamesparks.sendWithData("JoinChallengeRequest", request, onResponse);
}
GameSparks.prototype.leaderboardDataRequest = function(challengeInstanceId, entryCount, friendIds, leaderboardShortCode, offset, social, onResponse )
{
    var request = {};
    request["challengeInstanceId"] = challengeInstanceId;
    request["entryCount"] = entryCount;
    request["friendIds"] = friendIds;
    request["leaderboardShortCode"] = leaderboardShortCode;
    request["offset"] = offset;
    request["social"] = social;
    gamesparks.sendWithData("LeaderboardDataRequest", request, onResponse);
}
GameSparks.prototype.listAchievementsRequest = function(onResponse )
{
    var request = {};
    gamesparks.sendWithData("ListAchievementsRequest", request, onResponse);
}
GameSparks.prototype.listChallengeRequest = function(entryCount, offset, shortCode, state, onResponse )
{
    var request = {};
    request["entryCount"] = entryCount;
    request["offset"] = offset;
    request["shortCode"] = shortCode;
    request["state"] = state;
    gamesparks.sendWithData("ListChallengeRequest", request, onResponse);
}
GameSparks.prototype.listChallengeTypeRequest = function(onResponse )
{
    var request = {};
    gamesparks.sendWithData("ListChallengeTypeRequest", request, onResponse);
}
GameSparks.prototype.listGameFriendsRequest = function(onResponse )
{
    var request = {};
    gamesparks.sendWithData("ListGameFriendsRequest", request, onResponse);
}
GameSparks.prototype.listInviteFriendsRequest = function(onResponse )
{
    var request = {};
    gamesparks.sendWithData("ListInviteFriendsRequest", request, onResponse);
}
GameSparks.prototype.listLeaderboardsRequest = function(onResponse )
{
    var request = {};
    gamesparks.sendWithData("ListLeaderboardsRequest", request, onResponse);
}
GameSparks.prototype.listMessageRequest = function(entryCount, offset, onResponse )
{
    var request = {};
    request["entryCount"] = entryCount;
    request["offset"] = offset;
    gamesparks.sendWithData("ListMessageRequest", request, onResponse);
}
GameSparks.prototype.listMessageSummaryRequest = function(entryCount, offset, onResponse )
{
    var request = {};
    request["entryCount"] = entryCount;
    request["offset"] = offset;
    gamesparks.sendWithData("ListMessageSummaryRequest", request, onResponse);
}
GameSparks.prototype.listVirtualGoodsRequest = function(onResponse )
{
    var request = {};
    gamesparks.sendWithData("ListVirtualGoodsRequest", request, onResponse);
}
GameSparks.prototype.logChallengeEventRequest = function(challengeInstanceId, eventKey, onResponse )
{
    var request = {};
    request["challengeInstanceId"] = challengeInstanceId;
    request["eventKey"] = eventKey;
    gamesparks.sendWithData("LogChallengeEventRequest", request, onResponse);
}
GameSparks.prototype.logEventRequest = function(eventKey, onResponse )
{
    var request = {};
    request["eventKey"] = eventKey;
    gamesparks.sendWithData("LogEventRequest", request, onResponse);
}
GameSparks.prototype.pushRegistrationRequest = function(deviceOS, pushId, onResponse )
{
    var request = {};
    request["deviceOS"] = deviceOS;
    request["pushId"] = pushId;
    gamesparks.sendWithData("PushRegistrationRequest", request, onResponse);
}
GameSparks.prototype.registrationRequest = function(displayName, password, userName, onResponse )
{
    var request = {};
    request["displayName"] = displayName;
    request["password"] = password;
    request["userName"] = userName;
    gamesparks.sendWithData("RegistrationRequest", request, onResponse);
}
GameSparks.prototype.sendFriendMessageRequest = function(friendIds, message, onResponse )
{
    var request = {};
    request["friendIds"] = friendIds;
    request["message"] = message;
    gamesparks.sendWithData("SendFriendMessageRequest", request, onResponse);
}
GameSparks.prototype.socialLeaderboardDataRequest = function(challengeInstanceId, entryCount, friendIds, leaderboardShortCode, offset, social, onResponse )
{
    var request = {};
    request["challengeInstanceId"] = challengeInstanceId;
    request["entryCount"] = entryCount;
    request["friendIds"] = friendIds;
    request["leaderboardShortCode"] = leaderboardShortCode;
    request["offset"] = offset;
    request["social"] = social;
    gamesparks.sendWithData("SocialLeaderboardDataRequest", request, onResponse);
}
GameSparks.prototype.twitterConnectRequest = function(accessSecret, accessToken, onResponse )
{
    var request = {};
    request["accessSecret"] = accessSecret;
    request["accessToken"] = accessToken;
    gamesparks.sendWithData("TwitterConnectRequest", request, onResponse);
}
GameSparks.prototype.windowsBuyGoodsRequest = function(currencyCode, receipt, subUnitPrice, onResponse )
{
    var request = {};
    request["currencyCode"] = currencyCode;
    request["receipt"] = receipt;
    request["subUnitPrice"] = subUnitPrice;
    gamesparks.sendWithData("WindowsBuyGoodsRequest", request, onResponse);
}
GameSparks.prototype.withdrawChallengeRequest = function(challengeInstanceId, message, onResponse )
{
    var request = {};
    request["challengeInstanceId"] = challengeInstanceId;
    request["message"] = message;
    gamesparks.sendWithData("WithdrawChallengeRequest", request, onResponse);
}
var e,aa=document.getElementById("canvasBackground"),ba="big game_charmpopping2 theme_druid gameui_endless endscreen_endless poki_api final".split(" ");function ca(a,b){var c=a.userAgent.match(b);return c&&1<c.length&&c[1]||""}
var da=new function(){this.userAgent=void 0;void 0===this.userAgent&&(this.userAgent=void 0!==navigator?navigator.userAgent:"");var a=ca(this,/(ipod|iphone|ipad)/i).toLowerCase(),b=!/like android/i.test(this.userAgent)&&/android/i.test(this.userAgent),c=ca(this,/version\/(\d+(\.\d+)?)/i),d=/tablet/i.test(this.userAgent),f=!d&&/[^-]mobi/i.test(this.userAgent);this.s={};this.Wa={};this.gg={};/opera|opr/i.test(this.userAgent)?(this.name="Opera",this.s.opera=!0,this.s.version=c||ca(this,/(?:opera|opr)[\s\/](\d+(\.\d+)?)/i)):
/windows phone/i.test(this.userAgent)?(this.name="Windows Phone",this.Wa.Rp=!0,this.s.Bl=!0,this.s.version=ca(this,/iemobile\/(\d+(\.\d+)?)/i)):/msie|trident/i.test(this.userAgent)?(this.name="Internet Explorer",this.s.Bl=!0,this.s.version=ca(this,/(?:msie |rv:)(\d+(\.\d+)?)/i)):/Edge/i.test(this.userAgent)?(this.name="Microsoft Edge",this.s.Hz=!0,this.s.version=ca(this,/(?:msie |rv:)(\d+(\.\d+)?)/i)):/chrome|crios|crmo/i.test(this.userAgent)?(this.name="Chrome",this.s.chrome=!0,this.s.version=ca(this,
/(?:chrome|crios|crmo)\/(\d+(\.\d+)?)/i)):a?(this.name="iphone"==a?"iPhone":"ipad"==a?"iPad":"iPod",c&&(this.s.version=c)):/sailfish/i.test(this.userAgent)?(this.name="Sailfish",this.s.sB=!0,this.s.version=ca(this,/sailfish\s?browser\/(\d+(\.\d+)?)/i)):/seamonkey\//i.test(this.userAgent)?(this.name="SeaMonkey",this.s.HB=!0,this.s.version=ca(this,/seamonkey\/(\d+(\.\d+)?)/i)):/firefox|iceweasel/i.test(this.userAgent)?(this.name="Firefox",this.s.rr=!0,this.s.version=ca(this,/(?:firefox|iceweasel)[ \/](\d+(\.\d+)?)/i),
/\((mobile|tablet);[^\)]*rv:[\d\.]+\)/i.test(this.userAgent)&&(this.Wa.Rz=!0)):/silk/i.test(this.userAgent)?(this.name="Amazon Silk",this.s.gt=!0,this.s.version=ca(this,/silk\/(\d+(\.\d+)?)/i)):b?(this.name="Android",this.s.Th=!0,this.s.version=c):/phantom/i.test(this.userAgent)?(this.name="PhantomJS",this.s.YA=!0,this.s.version=ca(this,/phantomjs\/(\d+(\.\d+)?)/i)):/blackberry|\bbb\d+/i.test(this.userAgent)||/rim\stablet/i.test(this.userAgent)?(this.name="BlackBerry",this.s.Aq=!0,this.s.version=
c||ca(this,/blackberry[\d]+\/(\d+(\.\d+)?)/i)):/(web|hpw)os/i.test(this.userAgent)?(this.name="WebOS",this.s.ou=!0,this.s.version=c||ca(this,/w(?:eb)?osbrowser\/(\d+(\.\d+)?)/i),/touchpad\//i.test(this.userAgent)&&(this.gg.cC=!0)):/bada/i.test(this.userAgent)?(this.name="Bada",this.s.yq=!0,this.s.version=ca(this,/dolfin\/(\d+(\.\d+)?)/i)):/tizen/i.test(this.userAgent)?(this.name="Tizen",this.s.Iy=!0,this.s.version=ca(this,/(?:tizen\s?)?browser\/(\d+(\.\d+)?)/i)||c):/safari/i.test(this.userAgent)&&
(this.name="Safari",this.s.jp=!0,this.s.version=c);/(apple)?webkit/i.test(this.userAgent)?(this.name=this.name||"Webkit",this.s.hC=!0,!this.s.version&&c&&(this.s.version=c)):!this.opera&&/gecko\//i.test(this.userAgent)&&(this.name=this.name||"Gecko",this.s.Zz=!0,this.s.version=this.s.version||ca(this,/gecko\/(\d+(\.\d+)?)/i));b||this.gt?this.Wa.Zy=!0:a&&(this.Wa.jl=!0);c="";a?(c=ca(this,/os (\d+([_\s]\d+)*) like mac os x/i),c=c.replace(/[_\s]/g,".")):b?c=ca(this,/android[ \/-](\d+(\.\d+)*)/i):this.Rp?
c=ca(this,/windows phone (?:os)?\s?(\d+(\.\d+)*)/i):this.ou?c=ca(this,/(?:web|hpw)os\/(\d+(\.\d+)*)/i):this.Aq?c=ca(this,/rim\stablet\sos\s(\d+(\.\d+)*)/i):this.yq?c=ca(this,/bada\/(\d+(\.\d+)*)/i):this.Iy&&(c=ca(this,/tizen[\/\s](\d+(\.\d+)*)/i));c&&(this.Wa.version=c);c=c.split(".")[0];if(d||"ipad"==a||b&&(3==c||4==c&&!f)||this.gt)this.gg.Gt=!0;else if(f||"iphone"==a||"ipod"==a||b||this.Aq||this.ou||this.yq)this.gg.Ds=!0;this.lf={Wc:!1,Ki:!1,x:!1};this.Bl&&10<=this.s.version||this.chrome&&20<=this.s.version||
this.rr&&20<=this.s.version||this.jp&&6<=this.s.version||this.opera&&10<=this.s.version||this.jl&&this.Wa.version&&6<=this.Wa.version.split(".")[0]?this.lf.Wc=!0:this.Bl&&10>this.s.version||this.chrome&&20>this.s.version||this.rr&&20>this.s.version||this.jp&&6>this.s.version||this.opera&&10>this.s.version||this.jl&&this.Wa.version&&6>this.Wa.version.split(".")[0]?this.lf.Ki=!0:this.lf.x=!0;try{this.s.Ye=this.s.version?parseFloat(this.s.version.match(/\d+(\.\d+)?/)[0],10):0}catch(h){this.s.Ye=0}try{this.Wa.Ye=
this.Wa.version?parseFloat(this.Wa.version.match(/\d+(\.\d+)?/)[0],10):0}catch(k){this.Wa.Ye=0}};function g(a,b){this.x=a;this.y=b}function ea(a,b){return new g(b*Math.cos(Math.PI*a/180),-b*Math.sin(Math.PI*a/180))}e=g.prototype;e.length=function(){return Math.sqrt(this.x*this.x+this.y*this.y)};e.direction=function(){return 180*Math.atan2(-this.y,this.x)/Math.PI};e.P=function(){return new g(this.x,this.y)};e.add=function(a){return new g(this.x+a.x,this.y+a.y)};
e.dc=function(a){return new g(this.x-a.x,this.y-a.y)};e.scale=function(a){return new g(a*this.x,a*this.y)};e.rotate=function(a){var b=Math.sin(a*Math.PI/180);a=Math.cos(a*Math.PI/180);return new g(a*this.x+b*this.y,-b*this.x+a*this.y)};e.fg=function(a){return this.x*a.x+this.y*a.y};e.normalize=function(){var a=Math.sqrt(this.x*this.x+this.y*this.y);return 0===a?new g(0,0):new g(this.x/a,this.y/a)};function fa(a){return(new g(a.y,-a.x)).normalize()}
e.oc=function(a,b,c){var d=Math.min(8,this.length()/4),f=this.dc(this.normalize().scale(2*d)),h=f.add(fa(this).scale(d)),d=f.add(fa(this).scale(-d)),k=m.context;k.strokeStyle=c;k.beginPath();k.moveTo(a,b);k.lineTo(a+f.x,b+f.y);k.lineTo(a+h.x,b+h.y);k.lineTo(a+this.x,b+this.y);k.lineTo(a+d.x,b+d.y);k.lineTo(a+f.x,b+f.y);k.stroke()};function ga(a){this.sj=4294967296;this.Wc=1664525;this.Ki=1013904223;this.state=void 0===a?Math.floor(Math.random()*(this.sj-1)):a}
ga.prototype.P=function(){var a=new ga;a.sj=this.sj;a.Wc=this.Wc;a.Ki=this.Ki;a.state=this.state;return a};ga.prototype.random=function(a){var b=1;void 0!==a&&(b=a);this.state=(this.Wc*this.state+this.Ki)%this.sj;return this.state/this.sj*b};function ha(a,b){var c=1;void 0!==b&&(c=b);return Math.floor(a.random(c+1))}new ga;function ia(){this.af="";this.Nm=[];this.ui=[];this.Nf=[];this.Xg=[];this.Uc=[];this.V("start");this.V("load");this.V("game")}
function ja(a){var b=ka;b.af=a;""!==b.af&&"/"!==b.af[b.af.length-1]&&(b.af+="/")}e=ia.prototype;e.V=function(a){this.Uc[a]||(this.ui[a]=0,this.Nf[a]=0,this.Xg[a]=0,this.Uc[a]=[],this.Nm[a]=!1)};e.loaded=function(a){return this.Uc[a]?this.Nf[a]:0};e.fd=function(a){return this.Uc[a]?this.Xg[a]:0};e.complete=function(a){return this.Uc[a]?this.Nf[a]+this.Xg[a]===this.ui[a]:!0};function la(a){var b=ka;return b.Uc[a]?100*(b.Nf[a]+b.Xg[a])/b.ui[a]:100}
function ma(a){var b=ka;b.Nf[a]+=1;b.complete(a)&&na("Load Complete",{lb:a})}function oa(a){var b=ka;b.Xg[a]+=1;na("Load Failed",{lb:a})}function qa(a,b,c){var d=ka;d.Uc[b]||d.V(b);d.Uc[b].push(a);d.ui[b]+=c}e.be=function(a){var b;if(!this.Nm[a])if(this.Nm[a]=!0,this.Uc[a]&&0!==this.Uc[a].length)for(b=0;b<this.Uc[a].length;b+=1)this.Uc[a][b].be(a,this.af);else na("Load Complete",{lb:a})};var ka=new ia;function ra(a){this.context=this.canvas=void 0;this.height=this.width=0;a&&this.ia(a)}
ra.prototype.ia=function(a){this.canvas=a;this.context=a.getContext("2d");this.width=a.width;this.height=a.height};ra.prototype.clear=function(){this.context.clearRect(0,0,this.width,this.height);this.context.beginPath();this.context.moveTo(0,0);this.context.lineTo(-1,-1);this.context.closePath();this.context.stroke()};
function sa(a,b,c,d,f,h){var k=m;k.context.save();!1===h?(k.context.fillStyle=f,k.context.fillRect(a,b,c,d)):!0===h?(k.context.strokeStyle=f,k.context.strokeRect(a,b,c,d)):(void 0!==f&&(k.context.fillStyle=f,k.context.fillRect(a,b,c,d)),void 0!==h&&(k.context.strokeStyle=h,k.context.strokeRect(a,b,c,d)));k.context.restore()}
function ta(a,b,c,d){var f=m;f.context.save();f.context.beginPath();f.context.moveTo(a,b);f.context.lineTo(c,d);f.context.lineWidth=1;f.context.strokeStyle="green";f.context.stroke();f.context.restore()}
ra.prototype.Ic=function(a,b,c,d,f,h,k){this.context.save();this.context.font=f;!1===h?(this.context.fillStyle=d,this.context.fillText(a,b,c)):!0===h?(this.context.strokeStyle=d,this.context.strokeText(a,b,c)):(void 0!==d&&(this.context.fillStyle=d,this.context.fillText(a,b,c)),void 0!==h&&(k&&(this.context.lineWidth=k),this.context.strokeStyle=h,this.context.strokeText(a,b,c)));this.context.restore()};ra.prototype.$=function(a,b){this.context.font=b;return this.context.measureText(a).width};
var m=new ra(aa);function ua(a,b,c){this.name=a;this.D=b;this.ew=c;this.Yc=[];this.Kn=[];qa(this,this.ew,this.D)}ua.prototype.be=function(a,b){function c(){oa(a)}function d(){ma(a)}var f,h;for(f=0;f<this.Yc.length;f+=1)h=this.Kn[f],0!==h.toLowerCase().indexOf("http:")&&0!==h.toLowerCase().indexOf("https:")&&(h=b+h),this.Yc[f].src=h,this.Yc[f].addEventListener("load",d,!1),this.Yc[f].addEventListener("error",c,!1)};
ua.prototype.complete=function(){var a;for(a=0;a<this.Yc.length;a+=1)if(!this.Yc[a].complete||0===this.Yc[a].width)return!1;return!0};function va(a,b,c){0<=b&&b<a.D&&(a.Yc[b]=new Image,a.Kn[b]=c)}ua.prototype.c=function(a,b){0<=a&&a<this.D&&(this.Yc[a]=b,this.Kn[a]="")};ua.prototype.Ca=function(a,b,c,d,f,h,k,l,n){this.Yc[a]&&this.Yc[a].complete&&(void 0===l&&(l=d),void 0===n&&(n=f),0>=d||0>=f||0!==Math.round(l)&&0!==Math.round(n)&&m.context.drawImage(this.Yc[a],b,c,d,f,h,k,l,n))};
function p(a,b,c,d,f,h,k,l,n,q){this.name=a;this.We=b;this.D=c;this.width=d;this.height=f;this.$a=h;this.Ua=k;this.Oi=l;this.lh=n;this.Fh=q;this.Bf=[];this.Cf=[];this.Df=[];this.Te=[];this.Se=[];this.Ue=[];this.Ve=[]}e=p.prototype;e.c=function(a,b,c,d,f,h,k,l){0<=a&&a<this.D&&(this.Bf[a]=b,this.Cf[a]=c,this.Df[a]=d,this.Te[a]=f,this.Se[a]=h,this.Ue[a]=k,this.Ve[a]=l)};e.complete=function(){return this.We.complete()};
e.o=function(a,b,c){a=(Math.round(a)%this.D+this.D)%this.D;this.We.Ca(this.Bf[a],this.Cf[a],this.Df[a],this.Te[a],this.Se[a],b-this.$a+this.Ue[a],c-this.Ua+this.Ve[a])};e.dd=function(a,b,c,d){var f=m.context,h=f.globalAlpha;f.globalAlpha=d;a=(Math.round(a)%this.D+this.D)%this.D;this.We.Ca(this.Bf[a],this.Cf[a],this.Df[a],this.Te[a],this.Se[a],b-this.$a+this.Ue[a],c-this.Ua+this.Ve[a]);f.globalAlpha=h};
e.S=function(a,b,c,d,f,h,k){var l=m.context;1E-4>Math.abs(d)||1E-4>Math.abs(f)||(a=(Math.round(a)%this.D+this.D)%this.D,l.save(),l.translate(b,c),l.rotate(-h*Math.PI/180),l.scale(d,f),l.globalAlpha=k,this.We.Ca(this.Bf[a],this.Cf[a],this.Df[a],this.Te[a],this.Se[a],this.Ue[a]-this.$a,this.Ve[a]-this.Ua),l.restore())};
e.Ca=function(a,b,c,d,f,h,k,l){var n=m.context,q=n.globalAlpha,u,B,C,t;a=(Math.round(a)%this.D+this.D)%this.D;u=this.Ue[a];B=this.Ve[a];C=this.Te[a];t=this.Se[a];b-=u;c-=B;0>=b+d||0>=c+f||b>=C||c>=t||(0>b&&(d+=b,h-=b,b=0),0>c&&(f+=c,k-=c,c=0),b+d>C&&(d=C-b),c+f>t&&(f=t-c),n.globalAlpha=l,this.We.Ca(this.Bf[a],this.Cf[a]+b,this.Df[a]+c,d,f,h,k),n.globalAlpha=q)};
e.Bn=function(a,b,c,d,f,h,k,l,n,q,u,B){var C,t,s,v,w,T,ya,Z,pa,Ra;if(!(0>=h||0>=k))for(b=Math.round(b)%h,0<b&&(b-=h),c=Math.round(c)%k,0<c&&(c-=k),C=Math.ceil((q-b)/h),t=Math.ceil((u-c)/k),b+=l,c+=n,pa=0;pa<C;pa+=1)for(Ra=0;Ra<t;Ra+=1)w=d,T=f,ya=h,Z=k,s=b+pa*h,v=c+Ra*k,s<l&&(w+=l-s,ya-=l-s,s=l),s+ya>=l+q&&(ya=l+q-s),v<n&&(T+=n-v,Z-=n-v,v=n),v+Z>=n+u&&(Z=n+u-v),0<ya&&0<Z&&this.Ca(a,w,T,ya,Z,s,v,B)};e.Fk=function(a,b,c,d,f,h,k,l,n,q){this.Bn(a,0,0,b,c,d,f,h,k,l,n,q)};
e.Ek=function(a,b,c,d,f,h,k,l,n,q){var u=m.context,B=u.globalAlpha,C,t,s,v,w,T;a=(Math.round(a)%this.D+this.D)%this.D;C=l/d;t=n/f;s=this.Ue[a];v=this.Ve[a];w=this.Te[a];T=this.Se[a];b-=s;c-=v;0>=b+d||0>=c+f||b>=w||c>=T||(0>b&&(d+=b,l+=C*b,h-=C*b,b=0),0>c&&(f+=c,n+=t*c,k-=t*c,c=0),b+d>w&&(l-=C*(d-w+b),d=w-b),c+f>T&&(n-=t*(f-T+c),f=T-c),u.globalAlpha=q,this.We.Ca(this.Bf[a],this.Cf[a]+b,this.Df[a]+c,d,f,h,k,l,n),u.globalAlpha=B)};
function wa(a,b,c){var d,f,h;for(d=0;d<a.D;d+=1)f=b+d%a.Fh*a.width,h=c+a.height*Math.floor(d/a.Fh),a.We.Ca(a.Bf[d],a.Cf[d],a.Df[d],a.Te[d],a.Se[d],f-a.$a+a.Ue[d],h-a.Ua+a.Ve[d])}function r(a,b){this.canvas=document.createElement("canvas");this.context=this.canvas.getContext("2d");this.width=a;this.height=b;this.Ua=this.$a=0;this.canvas.width=a;this.canvas.height=b;this.clear();this.El=void 0}e=r.prototype;
e.P=function(){var a=new r(this.width,this.height);a.$a=this.$a;a.Ua=this.Ua;x(a);this.o(0,0);y(a);return a};function x(a){a.El=m.canvas;m.ia(a.canvas)}function y(a){m.canvas===a.canvas&&void 0!==a.El&&(m.ia(a.El),a.El=void 0)}e.clear=function(){this.context.clearRect(0,0,this.canvas.width,this.canvas.height)};e.o=function(a,b){m.context.drawImage(this.canvas,a-this.$a,b-this.Ua)};
e.dd=function(a,b,c){var d=m.context,f=d.globalAlpha;d.globalAlpha=c;m.context.drawImage(this.canvas,a-this.$a,b-this.Ua);d.globalAlpha=f};e.S=function(a,b,c,d,f,h){var k=m.context;1E-4>Math.abs(c)||1E-4>Math.abs(d)||(k.save(),k.translate(a,b),k.rotate(-f*Math.PI/180),k.scale(c,d),k.globalAlpha=h,m.context.drawImage(this.canvas,-this.$a,-this.Ua),k.restore())};
e.Ca=function(a,b,c,d,f,h,k){var l=m.context,n=l.globalAlpha;0>=c||0>=d||(a+c>this.width&&(c=this.width-a),b+d>this.height&&(d=this.height-b),l.globalAlpha=k,m.context.drawImage(this.canvas,a,b,c,d,f,h,c,d),l.globalAlpha=n)};
e.Bn=function(a,b,c,d,f,h,k,l,n,q,u){var B,C,t,s,v,w,T,ya,Z,pa;if(!(0>=f||0>=h))for(c+f>this.width&&(f=this.width-c),d+h>this.height&&(h=this.height-d),a=Math.round(a)%f,0<a&&(a-=f),b=Math.round(b)%h,0<b&&(b-=h),B=Math.ceil((n-a)/f),C=Math.ceil((q-b)/h),a+=k,b+=l,Z=0;Z<B;Z+=1)for(pa=0;pa<C;pa+=1)v=c,w=d,T=f,ya=h,t=a+Z*f,s=b+pa*h,t<k&&(v+=k-t,T-=k-t,t=k),t+T>=k+n&&(T=k+n-t),s<l&&(w+=l-s,ya-=l-s,s=l),s+ya>=l+q&&(ya=l+q-s),0<T&&0<ya&&this.Ca(v,w,T,ya,t,s,u)};
e.Fk=function(a,b,c,d,f,h,k,l,n){this.Bn(0,0,a,b,c,d,f,h,k,l,n)};e.Ek=function(a,b,c,d,f,h,k,l,n){var q=m.context,u=q.globalAlpha;0>=c||0>=d||(a+c>this.width&&(c=this.width-a),b+d>this.height&&(d=this.height-b),0!==Math.round(k)&&0!==Math.round(l)&&(q.globalAlpha=n,m.context.drawImage(this.canvas,a,b,c,d,f,h,k,l),q.globalAlpha=u))};function xa(a){this.name=a;this.align="left";this.i="base";this.wm=this.bc=0}e=xa.prototype;e.complete=function(){return this.b.We.complete()};
function za(a,b,c){var d=[],f,h,k;if(void 0===c)return d=b.split("\n");0>c&&(c=0);h=f=0;for(d[0]="";f<b.length;)if("\n"===b[f])d.push(""),h=0,f+=1;else if(k=d.length-1,h+=a.width[b.charCodeAt(f)],h>c&&0<d[k].length){for(h=d[k].length-1;0<=h&&" "!==d[k][h];)h-=1;0<=h&&(f=f-d[k].length+h+1,d[k]=d[k].substr(0,h));d.push("");h=0}else d[k]+=b[f],h+=a.wm,f+=1;return d}e.Pf=function(a){var b=0,c;for(c=a.length-1;0<=c;c-=1)b+=this.width[a.charCodeAt(c)]+this.wm;return b-this.wm};
e.$=function(a,b){var c=za(this,a,b),d=0,f;for(f=c.length-1;0<=f;f-=1)d=Math.max(d,this.Pf(c[f]));return d};e.U=function(a,b){var c=za(this,a,b);return c.length*this.height+(c.length-1)*this.bc};
e.o=function(a,b,c,d){a=za(this,a,d);d=a.length*this.height+(a.length-1)*this.bc;var f,h,k,l;switch(this.i){case "top":c-=this.top;break;case "middle":c-=this.top+Math.round(d/2);break;case "base":c-=this.eh;break;case "bottom":c-=this.top+d}d=c;for(h=0;h<a.length;h+=1){c=b;switch(this.align){case "left":c=b;break;case "center":c=b-Math.round(this.Pf(a[h])/2);break;case "right":c=b-this.Pf(a[h])}for(f=0;f<a[h].length;f+=1)k=a[h].charCodeAt(f),l=this.index[k],0<=l&&this.b.o(l,c-this.left[k],d),c+=
this.width[k]+this.wm;d+=this.height+this.bc}};e.dd=function(a,b,c,d,f){var h=m.context;h.save();h.globalAlpha=d;this.o(a,b,c,f);h.restore()};e.S=function(a,b,c,d,f,h,k,l){var n=m.context;1E-4>Math.abs(d)||1E-4>Math.abs(f)||(n.save(),n.translate(b,c),n.rotate(-h*Math.PI/180),n.scale(d,f),n.globalAlpha=k,this.o(a,0,0,l/d),n.restore())};
function Aa(a,b,c,d){this.H=a;this.Qy=b;this.Ky=c;this.Yj=[{text:"MiHhX!@v&Qq",width:-1,font:"sans-serif"},{text:"MiHhX!@v&Qq",width:-1,font:"serif"},{text:"AaMm#@!Xx67",width:-1,font:"sans-serif"},{text:"AaMm#@!Xx67",width:-1,font:"serif"}];this.Bt=!1;qa(this,d,1)}function Ba(a,b,c){m.context.save();m.context.font="250pt "+a+", "+b;a=m.context.measureText(c).width;m.context.restore();return a}
function Ca(a){var b,c,d;for(b=0;b<a.Yj.length;b+=1)if(c=a.Yj[b],d=Ba(a.H,c.font,c.text),c.width!==d){ma(a.dw);document.body.removeChild(a.Ze);a.Bt=!0;return}window.setTimeout(function(){Ca(a)},33)}
Aa.prototype.be=function(a,b){var c="@font-face {font-family: "+this.H+";src: url('"+b+this.Qy+"') format('woff'), url('"+b+this.Ky+"') format('truetype');}",d=document.createElement("style");d.id=this.H+"_fontface";d.type="text/css";d.styleSheet?d.styleSheet.cssText=c:d.appendChild(document.createTextNode(c));document.getElementsByTagName("head")[0].appendChild(d);this.Ze=document.createElement("span");this.Ze.style.position="absolute";this.Ze.style.left="-9999px";this.Ze.style.top="-9999px";this.Ze.style.visibility=
"hidden";this.Ze.style.fontSize="250pt";this.Ze.id=this.H+"_loader";document.body.appendChild(this.Ze);for(c=0;c<this.Yj.length;c+=1)d=this.Yj[c],d.width=Ba(d.font,d.font,d.text);this.dw=a;Ca(this)};Aa.prototype.complete=function(){return this.Bt};
function z(a,b){this.H=a;this.Xi=b;this.fontWeight=this.fontStyle="";this.qh="normal";this.fontSize=12;this.fill=!0;this.hg=1;this.gd=0;this.fillColor="black";this.xd={b:void 0,cc:0,gp:!0,hp:!0};this.ib={Rj:!0,D:3,wk:["red","white","blue"],size:.6,offset:0};this.fillStyle=void 0;this.stroke=!1;this.Ig=1;this.Uh=0;this.strokeColor="black";this.strokeStyle=void 0;this.pd=1;this.Re=!1;this.Jg="miter";this.O={h:!1,color:"rgba(10, 10, 10, 0.3)",offsetX:3,offsetY:3,blur:1};this.align="left";this.i="top";
this.bc=this.tf=0}e=z.prototype;
e.P=function(){var a=new z(this.H,this.Xi);a.fontStyle=this.fontStyle;a.fontWeight=this.fontWeight;a.qh=this.qh;a.fontSize=this.fontSize;a.fill=this.fill;a.hg=this.hg;a.gd=this.gd;a.fillColor=this.fillColor;a.xd={b:this.xd.b,gp:this.xd.gp,hp:this.xd.hp};a.ib={Rj:this.ib.Rj,D:this.ib.D,wk:this.ib.wk.slice(0),size:this.ib.size,offset:this.ib.offset};a.fillStyle=this.fillStyle;a.stroke=this.stroke;a.Ig=this.Ig;a.Uh=this.Uh;a.strokeColor=this.strokeColor;a.strokeStyle=this.strokeStyle;a.pd=this.pd;a.Re=
this.Re;a.Jg=this.Jg;a.O={h:this.O.h,color:this.O.color,offsetX:this.O.offsetX,offsetY:this.O.offsetY,blur:this.O.blur};a.align=this.align;a.i=this.i;a.tf=this.tf;a.bc=this.bc;return a};
function A(a,b){void 0!==b.H&&(a.H=b.H);void 0!==b.Xi&&(a.Xi=b.Xi);void 0!==b.fontStyle&&(a.fontStyle=b.fontStyle);void 0!==b.fontWeight&&(a.fontWeight=b.fontWeight);void 0!==b.qh&&(a.qh=b.qh);void 0!==b.fontSize&&(a.fontSize=b.fontSize);void 0!==b.fill&&(a.fill=b.fill);void 0!==b.hg&&(a.hg=b.hg);void 0!==b.fillColor&&(a.gd=0,a.fillColor=b.fillColor);void 0!==b.xd&&(a.gd=1,a.xd=b.xd);void 0!==b.ib&&(a.gd=2,a.ib=b.ib);void 0!==b.fillStyle&&(a.gd=3,a.fillStyle=b.fillStyle);void 0!==b.stroke&&(a.stroke=
b.stroke);void 0!==b.Ig&&(a.Ig=b.Ig);void 0!==b.strokeColor&&(a.Uh=0,a.strokeColor=b.strokeColor);void 0!==b.strokeStyle&&(a.Uh=3,a.strokeStyle=b.strokeStyle);void 0!==b.pd&&(a.pd=b.pd);void 0!==b.Re&&(a.Re=b.Re);void 0!==b.Jg&&(a.Jg=b.Jg);void 0!==b.O&&(a.O=b.O);void 0!==b.align&&(a.align=b.align);void 0!==b.i&&(a.i=b.i);void 0!==b.tf&&(a.tf=b.tf);void 0!==b.bc&&(a.bc=b.bc)}function Da(a,b){a.fontWeight=void 0===b?"":b}function D(a,b){a.fontSize=void 0===b?12:b}function Ea(a){a.fill=!0}
function Fa(a,b){a.hg=void 0===b?1:b}e.setFillColor=function(a){this.gd=0;this.fillColor=void 0===a?"black":a};function Ga(a,b,c,d,f){a.gd=2;a.ib.Rj=!0;a.ib.D=b;a.ib.wk=c.slice(0);a.ib.size=void 0===d?.6:d;a.ib.offset=void 0===f?0:f}function Ha(a,b){a.stroke=void 0===b?!1:b}function Ia(a,b){a.Ig=void 0===b?1:b}e.setStrokeColor=function(a){this.Uh=0;this.strokeColor=void 0===a?"black":a};function Ja(a,b){a.pd=void 0===b?1:b}function Ka(a,b){a.Re=void 0===b?!1:b}
function La(a,b){a.Jg=void 0===b?"miter":b}function Ma(a,b,c,d,f,h){void 0===b?a.O={h:!1,color:"rgba(10, 10, 10, 0.3)",offsetX:3,offsetY:3,blur:1}:b instanceof Object?a.O={h:b.h,color:b.color,offsetX:b.offsetX,offsetY:b.offsetY,blur:b.blur}:void 0===c?a.O.h=b:a.O={h:b,color:c,offsetX:d,offsetY:f,blur:h}}function Na(a){return{h:a.O.h,color:a.O.color,offsetX:a.O.offsetX,offsetY:a.O.offsetY,blur:a.O.blur}}function E(a,b){a.align=void 0===b?"left":b}function F(a,b){a.i=void 0===b?"top":b}
function Oa(a){a.tf=0}function Pa(a){a.bc=0}function Qa(a){return a.fontStyle+" "+a.fontWeight+" "+a.fontSize+"px "+a.H+", "+a.Xi}e.Pf=function(a){var b=0,c;for(c=0;c<a.length;c+=1)b=Math.max(b,a[c].width);return b};function Sa(a,b){return a.fontSize*b.length+a.bc*(b.length-1)}
function Ta(a,b,c){var d,f,h,k,l,n,q=[],u=m.context;u.font=Qa(a);switch(a.qh){case "upper":b=b.toUpperCase();break;case "lower":b=b.toLowerCase()}if(void 0===c){n=b.split("\n");for(a=0;a<n.length;a+=1)q.push({text:n[a],width:u.measureText(n[a]).width});return q}n=b.split("\n");h=u.measureText(" ").width;for(a=0;a<n.length;a+=1){f=n[a].split(" ");d=f[0];l=u.measureText(f[0]).width;for(b=1;b<f.length;b+=1)k=u.measureText(f[b]).width,l+h+k<c?(d+=" "+f[b],l+=h+k):(q.push({text:d,width:l}),d=f[b],l=k);
q.push({text:d,width:l})}return q}e.$=function(a,b){var c;m.context.save();c=this.Pf(Ta(this,a,b));m.context.restore();return c};e.U=function(a,b){var c;m.context.save();c=Sa(this,Ta(this,a,b));m.context.restore();return c};function Ua(a,b,c,d,f,h){var k=a.fontSize;a.fontSize=b;b=h?Ta(a,c,d):Ta(a,c);d=a.Pf(b)<=d&&Sa(a,b)<=f;a.fontSize=k;return d}
function Va(a,b,c,d,f){var h=0,k=32;void 0===f&&(f=!1);for(m.context.save();Ua(a,h+k,b,c,d,f);)h+=k;for(;2<=k;)k/=2,Ua(a,h+k,b,c,d,f)&&(h+=k);m.context.restore();return Math.max(4,h)}function Wa(a,b,c,d,f){var h=Math.max(.01,a.ib.size),k=a.ib.offset;a.ib.Rj?(k=f/2+k*f,h=.5*h*f,b=m.context.createLinearGradient(b,c+k-h,b,c+k+h)):(k=d/2+k*d,h=.5*h*d,b=m.context.createLinearGradient(b+k-h,c,b+k+h,c));c=1/(a.ib.D-1);for(d=0;d<a.ib.D;d+=1)b.addColorStop(d*c,a.ib.wk[d]);return b}
function Xa(a,b,c,d,f,h,k){var l,n;!a.fill&&a.O.h?(b.shadowColor=a.O.color,b.shadowOffsetX=a.O.offsetX,b.shadowOffsetY=a.O.offsetY,b.shadowBlur=a.O.blur):(b.shadowColor=void 0,b.shadowOffsetX=0,b.shadowOffsetY=0,b.shadowBlur=0);b.globalAlpha=k*a.Ig;switch(a.Uh){case 0:b.strokeStyle=a.strokeColor;break;case 3:b.strokeStyle=a.strokeStyle}b.lineWidth=a.pd;b.lineJoin=a.Jg;for(k=0;k<c.length;k+=1){l=0;switch(a.align){case "right":l=h-c[k].width;break;case "center":l=(h-c[k].width)/2}n=a.fontSize*(k+1)+
a.bc*k;b.strokeText(c[k].text,d+l,f+n)}}
function Ya(a,b,c,d,f,h,k){c=Ta(a,c,k);k=a.Pf(c);var l=Sa(a,c);b.textAlign="left";b.textBaseline="bottom";switch(a.align){case "right":d+=-k;break;case "center":d+=-k/2}switch(a.i){case "base":case "bottom":f+=-l+Math.round(a.tf*a.fontSize);break;case "middle":f+=-l/2+Math.round(a.tf*a.fontSize/2)}b.font=Qa(a);a.stroke&&a.Re&&Xa(a,b,c,d,f,k,h);if(a.fill){var n=d,q=f,u,B;a.O.h?(b.shadowColor=a.O.color,b.shadowOffsetX=a.O.offsetX,b.shadowOffsetY=a.O.offsetY,b.shadowBlur=a.O.blur):(b.shadowColor=void 0,
b.shadowOffsetX=0,b.shadowOffsetY=0,b.shadowBlur=0);b.globalAlpha=h*a.hg;switch(a.gd){case 0:b.fillStyle=a.fillColor;break;case 1:l=a.xd.b;B=new r(l.width,l.height);var C=a.xd.gp,t=a.xd.hp;C&&t?u="repeat":C&&!t?u="repeat-x":!C&&t?u="repeat-y":C||t||(u="no-repeat");x(B);l.o(a.xd.cc,0,0);y(B);u=m.context.createPattern(B.canvas,u);b.fillStyle=u;break;case 2:b.fillStyle=Wa(a,n,q,k,l);break;case 3:b.fillStyle=a.fillStyle;break;default:b.fillStyle=a.fillColor}for(u=0;u<c.length;u+=1){l=0;switch(a.align){case "right":l=
k-c[u].width;break;case "center":l=(k-c[u].width)/2}B=a.fontSize*(u+1)+a.bc*u;2===a.gd&&a.ib.Rj&&(b.fillStyle=Wa(a,n,q+B-a.fontSize,k,a.fontSize));b.fillText(c[u].text,n+l,q+B)}}a.stroke&&!a.Re&&Xa(a,b,c,d,f,k,h)}e.o=function(a,b,c,d){var f=m.context;this.fill&&1===this.gd?this.S(a,b,c,1,1,0,1,d):(f.save(),Ya(this,f,a,b,c,1,d),f.restore())};e.dd=function(a,b,c,d,f){var h=m.context;this.fill&&1===this.gd?this.S(a,b,c,1,1,0,d,f):(h.save(),Ya(this,h,a,b,c,d,f),h.restore())};
e.S=function(a,b,c,d,f,h,k,l){var n=m.context;n.save();n.translate(b,c);n.rotate(-h*Math.PI/180);n.scale(d,f);try{Ya(this,n,a,0,0,k,l)}catch(q){}n.restore()};
function Za(){this.uw=10;this.ck=-1;this.zu="stop_lowest_prio";this.uq=this.Za=this.ob=!1;var a,b=this,c="undefined"!==typeof AudioContext?AudioContext:"undefined"!==typeof webkitAudioContext?webkitAudioContext:void 0;if(c)this.ob=!0;else if("undefined"!==typeof Audio)try{"undefined"!==typeof(new Audio).canPlayType&&(this.Za=!0)}catch(d){}this.uq=this.ob||this.Za;this.Za&&da.s.Th&&(this.ck=1);if(this.uq)try{a=new Audio,this.cq={ogg:!!a.canPlayType('audio/ogg; codecs="vorbis"').replace(/^no$/,""),
mp3:!!a.canPlayType("audio/mpeg;").replace(/^no$/,""),opus:!!a.canPlayType('audio/ogg; codecs="opus"').replace(/^no$/,""),wav:!!a.canPlayType('audio/wav; codecs="1"').replace(/^no$/,""),m4a:!!(a.canPlayType("audio/x-m4a;")||a.canPlayType("audio/aac;")).replace(/^no$/,""),mp4:!!(a.canPlayType("audio/x-mp4;")||a.canPlayType("audio/aac;")).replace(/^no$/,""),weba:!!a.canPlayType('audio/webm; codecs="vorbis"').replace(/^no$/,"")}}catch(f){this.cq={ogg:!1,mp3:!0,opus:!1,wav:!1,m4a:!1,mp4:!1,weba:!1}}this.vc=
[];this.Mf={};this.bb={};this.Gc={};this.fe=[];this.Fc=0;this.ob?(this.ee=new c,this.dq="function"===typeof this.ee.createGain?function(){return b.ee.createGain()}:"function"===typeof this.ee.createGainNode?function(){return b.ee.createGainNode()}:function(){},this.ge={},this.bk=this.dq(),void 0===this.bk?(this.Za=!0,this.gi=Za.prototype.Mm):(this.bk.connect(this.ee.destination),this.ge.master=this.bk,this.gi=Za.prototype.yu)):this.gi=this.Za?Za.prototype.Mm:function(){}}
function $a(a){var b=G,c,d,f,h,k;for(c=0;c<b.vc.length;c+=1)if((d=b.vc[c])&&0===d.Gn)if(d.paused)d.hq&&(d.Om+=a,d.Om>=d.hq&&b.Cj(d.id));else if(d.Pm+=a,d.Wg&&d.Pm>=d.rt)d.Wg=!1,ab(b,d,d.ie);else if(d.mb&&b.Za&&b.eo(d.id)>=d.duration)if(d.Io)try{d.F.pause(),d.F.currentTime=d.ie/1E3,4===d.F.readyState?d.F.play():(f=function(){var a=d;return{ready:function(){a.F.play();a.F.removeEventListener("canplaythrough",f.ready,!1)}}}(),d.F.addEventListener("canplaythrough",f.ready,!1))}catch(l){}else d.F.pause(),
bb(d);for(c=b.fe.length-1;0<=c;c-=1)h=b.fe[c],b.Xr(h.id)||0!==h.Gn||(h.m+=a,h.m>=h.duration?(G.$d(h.id,h.Ij),void 0!==b.Gc[h.id]&&(b.Gc[h.id]=h.Ij),h.Db&&h.Db(),b.fe.splice(c,1)):(k=h.hb(h.m,h.start,h.Ij-h.start,h.duration),G.$d(h.id,k),void 0!==b.Gc[h.id]&&(b.Gc[h.id]=k)))}function cb(a,b){a.Mf[b.Rb.q.name]?a.Mf[b.Rb.q.name].length<a.uw&&a.Mf[b.Rb.q.name].push(b.F):a.Mf[b.Rb.q.name]=[b.F]}
function db(a,b){var c,d,f;f=[];for(c=0;c<a.vc.length;c+=1)(d=a.vc[c])&&0<=d.wa.indexOf(b)&&f.push(d);return f}function eb(a,b){if(0<a.ck&&a.Fc>=a.ck)switch(a.zu){case "cancel_new":return!1;case "stop_lowest_prio":var c,d,f;for(c=0;c<a.vc.length;c+=1)(d=a.vc[c])&&d.mb&&!d.paused&&(void 0===f||f.Sl<d.Sl)&&(f=d);if(f.Sl>b.qi){a.stop(f.id);break}return!1}return!0}
function fb(a,b){var c,d=1;for(c=0;c<b.wa.length;c+=1)void 0!==G.bb[b.wa[c]]&&(d*=G.bb[b.wa[c]]);c=a.dq();c.gain.value=d;c.connect(a.bk);a.ge[b.id]=c;b.F.connect(c)}function hb(a,b){b.F.disconnect(0);a.ge[b.id]&&(a.ge[b.id].disconnect(0),delete a.ge[b.id])}function ib(a,b){var c;if(b.q&&b.q.lc){if(a.ob)return c=a.ee.createBufferSource(),c.buffer=b.q.lc,c.loopStart=b.startOffset/1E3,c.loopEnd=(b.startOffset+b.duration)/1E3,c;if(a.Za)return c=b.q.lc.cloneNode(!0),c.volume=0,c}}
function jb(a,b){var c,d;if(a.ob)(c=ib(a,b))&&(d=new kb(b,c));else if(a.Za){c=a.Mf[b.q.name];if(!c)return;0<c.length?d=new kb(b,c.pop()):(c=ib(a,b))&&(d=new kb(b,c))}if(d){a.ob&&fb(a,d);for(c=0;c<a.vc.length;c+=1)if(void 0===a.vc[c])return a.vc[c]=d;a.vc.push(d)}return d}function lb(a){var b=G,c,d;for(c=0;c<a.length;c+=1)if(d=a[c].split(".").pop(),b.cq[d])return a[c];return!1}e=Za.prototype;
e.Mm=function(a,b,c){function d(){var b;a.loaded=!0;ma(c);a.duration=Math.ceil(1E3*a.lc.duration);a.lc.removeEventListener("canplaythrough",d,!1);a.lc.removeEventListener("error",f,!1);b=a.lc.cloneNode(!0);G.Mf[a.name].push(b)}function f(){oa(c)}(b=lb(b))?(a.lc=new Audio,a.lc.src=b,a.lc.autoplay=!1,a.lc.aB="auto",a.lc.addEventListener("canplaythrough",d,!1),a.lc.addEventListener("error",f,!1),a.lc.load()):f()};
e.yu=function(a,b,c){var d=lb(b),f=new XMLHttpRequest;f.open("GET",d,!0);f.responseType="arraybuffer";f.onload=function(){G.ee.decodeAudioData(f.response,function(b){b&&(a.lc=b,a.duration=1E3*b.duration,a.loaded=!0,ma(c))},function(){oa(c)})};f.onerror=function(){"undefined"!==typeof Audio&&(G.ob=!1,G.Za=!0,G.gi=Za.prototype.Mm,G.gi(a,b,c))};try{f.send()}catch(h){}};
e.play=function(a,b,c,d){if(a instanceof H){if(eb(this,a)){a=jb(this,a);if(!a)return-1;a.rt=b||0;a.Wg=0<b;a.Ub=c||0;a.De=d||function(a,b,c,d){return 0==a?b:c*Math.pow(2,10*(a/d-1))+b};a.Wg||ab(this,a,a.ie);return a.id}return-1}};
function ab(a,b,c){var d;"number"!==typeof c&&(c=0);mb(a,b.id);0<b.Ub&&(d=nb(a,b.id),a.$d(b.id,0),ob(a,b.id,d,b.Ub,b.De),b.Ub=0,b.De=void 0);if(a.ob){d=c-b.ie;b.Au=1E3*a.ee.currentTime-d;b.F.onended=function(){bb(b)};try{b.F.start?b.F.start(0,c/1E3,(b.duration-d)/1E3):b.F.noteGrainOn&&b.F.noteGrainOn(0,c/1E3,(b.duration-d)/1E3),b.Nd=!0,b.mb=!0,a.Fc+=1,b.F.loop=b.Io}catch(f){}}else if(a.Za){if(4!==b.F.readyState){var h=function(){return{ready:function(){b.F.currentTime=c/1E3;b.F.play();b.Nd=!0;b.F.removeEventListener("canplaythrough",
h.ready,!1)}}}();b.F.addEventListener("canplaythrough",h.ready,!1)}else b.F.currentTime=c/1E3,b.F.play(),b.Nd=!0;b.mb=!0;a.Fc+=1}}
e.Cj=function(a,b,c,d){var f,h,k,l,n=db(this,a);for(f=0;f<n.length;f+=1)if(h=n[f],(h.paused||!h.mb)&&!d||!h.paused&&d){if(!d){for(f=this.fe.length-1;0<=f;f-=1)if(a=this.fe[f],a.id===h.id){l=a;b=0;c=void 0;break}h.paused=!1;h.Ub=b||0;h.De=c||function(a,b,c,d){return 0==a?b:c*Math.pow(2,10*(a/d-1))+b};h.ei&&(void 0===b&&(h.Ub=h.ei.duration),void 0===c&&(h.De=h.ei.hb),k=h.ei.gain,h.ei=void 0)}this.ob&&(a=ib(this,h.Rb))&&(h.F=a,fb(this,h));void 0!==k&&G.$d(h.id,k);ab(this,h,h.ie+(h.dk||0));void 0!==l&&
(G.$d(h.id,l.hb(l.m,l.start,l.Ij-l.start,l.duration)),ob(G,h.id,l.Ij,l.duration-l.m,l.hb,l.Db))}};
e.pause=function(a,b,c,d,f){var h,k,l=db(this,a);for(a=0;a<l.length;a+=1)if(h=l[a],!h.paused)if(h.Ub=c||0,0<h.Ub)h.De=d||function(a,b,c,d){return 0==a?b:c*Math.pow(2,10*(a/d-1))+b},h.ei={gain:pb(h.id),duration:h.Ub,hb:h.De},ob(G,h.id,0,h.Ub,h.De,function(){G.pause(h.id,b)});else if(k=this.eo(h.id),h.dk=k,f||(h.paused=!0,h.Om=0,h.hq=b,this.Fc-=1),this.ob){h.F.onended=function(){};if(h.mb&&h.Nd){try{h.F.stop?h.F.stop(0):h.F.noteOff&&h.F.noteOff(0)}catch(n){}h.Nd=!1}hb(this,h)}else this.Za&&h.F.pause()};
function bb(a){var b=G;b.bb[a.id]&&delete b.bb[a.id];a.paused||(b.Fc-=1);b.ob?(a.Nd=!1,a.mb=!1,hb(b,a)):b.Za&&cb(b,a);b.vc[b.vc.indexOf(a)]=void 0}
e.stop=function(a,b,c){var d,f=db(this,a);for(a=0;a<f.length;a+=1)if(d=f[a],d.Ub=b||0,0<d.Ub)d.De=c||function(a,b,c,d){return 0==a?b:c*Math.pow(2,10*(a/d-1))+b},ob(G,d.id,0,d.Ub,d.De,function(){G.stop(d.id)});else{this.bb[d.id]&&delete this.bb[d.id];d.mb&&!d.paused&&(this.Fc-=1);if(this.ob){if(d.mb&&!d.paused&&!d.Wg){if(d.Nd){try{d.F.stop?d.F.stop(0):d.F.noteOff&&d.F.noteOff(0)}catch(h){}d.Nd=!1}hb(this,d)}}else this.Za&&(d.Wg||d.F.pause(),cb(this,d));this.vc[this.vc.indexOf(d)]=void 0;d.mb=!1}};
function ob(a,b,c,d,f,h){var k;for(k=0;k<a.fe.length;k+=1)if(a.fe[k].id===b){a.fe.splice(k,1);break}a.fe.push({id:b,Ij:c,hb:f||function(a,b,c,d){return a==d?b+c:c*(-Math.pow(2,-10*a/d)+1)+b},duration:d,m:0,start:nb(a,b),Db:h,Gn:0})}function qb(a){var b=G,c;void 0===b.Gc[a]&&(c=void 0!==b.bb[a]?b.bb[a]:1,b.$d(a,0),b.Gc[a]=c)}function rb(a){var b=G;void 0!==b.Gc[a]&&(b.$d(a,b.Gc[a]),delete b.Gc[a])}
e.position=function(a,b){var c,d,f,h,k=db(this,a);if(!isNaN(b)&&0<=b)for(c=0;c<k.length;c++)if(d=k[c],b%=d.duration,this.ob)if(d.paused)d.dk=b;else{d.F.onended=function(){};if(d.Nd){try{d.F.stop?d.F.stop(0):d.F.noteOff&&d.F.noteOff(0)}catch(l){}d.Nd=!1}hb(this,d);this.Fc-=1;if(f=ib(this,d.Rb))d.F=f,fb(this,d),ab(this,d,d.ie+b)}else this.Za&&(4===d.F.readyState?d.F.currentTime=(d.ie+b)/1E3:(h=function(){var a=d,c=b;return{Er:function(){a.F.currentTime=(a.ie+c)/1E3;a.F.removeEventListener("canplaythrough",
h.Er,!1)}}}(),d.F.addEventListener("canplaythrough",h.Er,!1)))};e.ip=function(a){G.position(a,0)};e.$s=function(a,b){var c,d=db(this,a);for(c=0;c<d.length;c+=1)d[c].Io=b,this.ob&&(d[c].F.loop=b)};function nb(a,b){return void 0!==a.bb[b]?a.bb[b]:1}function pb(a){var b=G,c=1,d=db(b,a)[0];if(d)for(a=0;a<d.wa.length;a+=1)void 0!==b.bb[d.wa[a]]&&(c*=b.bb[d.wa[a]]);return Math.round(100*c)/100}
e.$d=function(a,b){var c,d,f,h=1,k=db(this,a);this.bb[a]=b;this.Gc[a]&&delete this.Gc[a];for(c=0;c<k.length;c+=1)if(d=k[c],0<=d.wa.indexOf(a)){for(f=0;f<d.wa.length;f+=1)void 0!==this.bb[d.wa[f]]&&(h*=this.bb[d.wa[f]]);h=Math.round(100*h)/100;this.ob?this.ge[d.id].gain.value=h:this.Za&&(d.F.volume=h)}};
function mb(a,b){var c,d,f,h=1,k=db(a,b);for(c=0;c<k.length;c+=1){d=k[c];for(f=0;f<d.wa.length;f+=1)void 0!==a.bb[d.wa[f]]&&(h*=a.bb[d.wa[f]]);h=Math.round(100*h)/100;a.ob?a.ge[d.id].gain.value=h:a.Za&&(d.F.volume=h)}}e.nq=function(a,b){var c,d,f,h=db(this,a);for(c=0;c<h.length;c+=1)for(d=h[c],b=[].concat(b),f=0;f<b.length;f+=1)0>d.wa.indexOf(b[f])&&d.wa.push(b[f]);mb(this,a)};e.Xr=function(a){if(a=db(this,a)[0])return a.paused};e.uo=function(a){return db(this,a)[0]?!0:!1};
e.eo=function(a){if(a=db(this,a)[0]){if(this.ob)return a.paused?a.dk:(1E3*G.ee.currentTime-a.Au)%a.duration;if(G.Za)return Math.ceil(1E3*a.F.currentTime-a.ie)}};var G=new Za;function sb(a,b,c,d){this.name=a;this.Ww=b;this.$w=c;this.Nc=d;this.loaded=!1;this.lc=null;qa(this,this.Nc,1)}
sb.prototype.be=function(a,b){var c,d;c=this.Ww;0!==c.toLowerCase().indexOf("http:")&&0!==c.toLowerCase().indexOf("https:")&&(c=b+c);d=this.$w;0!==d.toLowerCase().indexOf("http:")&&0!==d.toLowerCase().indexOf("https:")&&(d=b+d);G.Mf[this.name]=[];G.gi(this,[d,c],a)};sb.prototype.complete=function(){return this.loaded};
function H(a,b,c,d,f,h,k){this.name=a;this.q=b;this.startOffset=c;this.duration=d;G.$d(this.name,void 0!==f?f:1);this.qi=void 0!==h?h:10;this.wa=[];k&&(this.wa=this.wa.concat(k));0>this.wa.indexOf(this.name)&&this.wa.push(this.name)}H.prototype.complete=function(){return this.q.complete()};H.prototype.Sl=function(a){void 0!==a&&(this.qi=a);return this.qi};H.prototype.nq=function(a){var b;a=[].concat(a);for(b=0;b<a.length;b+=1)0>this.wa.indexOf(a[b])&&this.wa.push(a[b])};
function kb(a,b){this.Rb=a;this.ie=this.Rb.startOffset;this.F=b;this.duration=this.Rb.duration;this.$e()}kb.prototype.$e=function(){this.id=Math.round(Date.now()*Math.random())+"";this.wa=["master",this.id].concat(this.Rb.wa);this.Sl=void 0!==this.Rb.qi?this.Rb.qi:10;this.paused=this.mb=this.Io=!1;this.Pm=this.Gn=0;this.Nd=this.Wg=!1;this.rt=this.dk=0;var a,b=1;for(a=0;a<this.wa.length;a+=1)void 0!==G.bb[this.wa[a]]&&(b*=G.bb[this.wa[a]]);!G.ob&&G.Za&&(this.F.volume=b)};
function tb(a,b){this.name=a;this.fileName=b;this.info=void 0}function ub(a){this.name=a;this.text="";this.fd=this.complete=!1}ub.prototype.Nf=function(a){4===a.readyState&&(this.complete=!0,(this.fd=200!==a.status)?na("Get Failed",{name:this.name}):(this.text=a.responseText,na("Get Complete",{name:this.name})))};
function vb(a,b){var c=new XMLHttpRequest;a.complete=!1;c.open("POST",b);c.setRequestHeader("Content-Type","text/plain;charset=UTF-8");c.onreadystatechange=function(){4===c.readyState&&(a.complete=!0,a.fd=200!==c.status,a.fd?na("Post Failed",{name:a.name}):na("Post Complete",{name:a.name}))};c.send(a.text)}function wb(a,b){var c=new XMLHttpRequest;c.open("GET",b,!1);try{c.send()}catch(d){return!1}a.complete=!0;a.fd=200!==c.status;if(a.fd)return!1;a.text=c.responseText;return!0}
function xb(a){a&&(this.Zd=a);this.clear();this.ni=this.$g=this.ud=this.mi=this.li=this.pi=this.ii=this.oi=this.he=this.ki=this.ji=0;yb(this,this);zb(this,this);Ab(this,this);this.ec=[];this.ai=[];this.si=[];this.L=0;this.iq=!1;this.ll=this.startTime=Date.now();this.Hg=this.vh=0;this.vw=200;this.Nc="";window.Vj(window.$p)}xb.prototype.clear=function(){this.C=[];this.ti=!1;this.kc=[];this.Jm=!1};
function yb(a,b){window.addEventListener("click",function(a){var d,f,h;if(void 0!==b.Zd&&!(0<b.L)&&(d=b.Zd,f=d.getBoundingClientRect(),h=d.width/f.width*(a.clientX-f.left),d=d.height/f.height*(a.clientY-f.top),a.preventDefault(),b.Vg.x=h,b.Vg.y=d,b.ci.push({x:b.Vg.x,y:b.Vg.y}),0<b.mi))for(a=b.C.length-1;0<=a&&!((h=b.C[a])&&h.h&&0>=h.L&&h.ko&&(h=h.ko(b.Vg.x,b.Vg.y),!0===h));a-=1);},!1);Bb(a)}function Bb(a){a.Vg={x:0,y:0};a.ci=[]}
function zb(a,b){window.addEventListener("mousedown",function(a){0<b.L||(a.preventDefault(),window.focus(),b.gq>=Date.now()-1E3||(Cb(b,0,a.clientX,a.clientY),Db(b,0)))},!1);window.addEventListener("mouseup",function(a){0<b.L||(a.preventDefault(),b.ak>=Date.now()-1E3||(Cb(b,0,a.clientX,a.clientY),Eb(b,0)))},!1);window.addEventListener("mousemove",function(a){0<b.L||(a.preventDefault(),Cb(b,0,a.clientX,a.clientY))},!1);window.addEventListener("touchstart",function(a){var d=a.changedTouches;b.gq=Date.now();
if(!(0<b.L))for(a.preventDefault(),window.focus(),a=0;a<d.length;a+=1)Cb(b,d[a].identifier,d[a].clientX,d[a].clientY),Db(b,d[a].identifier)},!1);window.addEventListener("touchend",function(a){var d=a.changedTouches;b.ak=Date.now();if(!(0<b.L))for(a.preventDefault(),a=0;a<d.length;a+=1)Cb(b,d[a].identifier,d[a].clientX,d[a].clientY),Eb(b,d[a].identifier)},!1);window.addEventListener("touchmove",function(a){var d=a.changedTouches;if(!(0<b.L))for(a.preventDefault(),a=0;a<d.length;a+=1)Cb(b,d[a].identifier,
d[a].clientX,d[a].clientY)},!1);window.addEventListener("touchleave",function(a){var d=a.changedTouches;b.ak=Date.now();if(!(0<b.L))for(a.preventDefault(),a=0;a<d.length;a+=1)Cb(b,d[a].identifier,d[a].clientX,d[a].clientY),Eb(b,d[a].identifier)},!1);window.addEventListener("touchcancel",function(a){var d=a.changedTouches;b.ak=Date.now();if(!(0<b.L))for(a.preventDefault(),a=0;a<d.length;a+=1)Cb(b,d[a].identifier,d[a].clientX,d[a].clientY),Eb(b,d[a].identifier)},!1);window.addEventListener("mousewheel",
function(a){Fb(b,a)},!1);window.addEventListener("DOMMouseScroll",function(a){Fb(b,a)},!1);Gb(a);a.gq=0;a.ak=0}function Gb(a){var b;a.ha=[];for(b=0;16>b;b+=1)a.ha[b]={id:-1,wb:!1,x:0,y:0};a.Qf=[]}function Hb(a,b){var c=-1,d;for(d=0;16>d;d+=1)if(a.ha[d].id===b){c=d;break}if(-1===c)for(d=0;16>d;d+=1)if(!a.ha[d].wb){c=d;a.ha[d].id=b;break}return c}
function Cb(a,b,c,d){var f,h;void 0!==a.Zd&&(b=Hb(a,b),-1!==b&&(f=a.Zd,h=f.getBoundingClientRect(),a.ha[b].x=f.width/h.width*(c-h.left),a.ha[b].y=f.height/h.height*(d-h.top)))}function Db(a,b){var c=Hb(a,b),d,f;if(-1!==c&&!a.ha[c].wb&&(a.Qf.push({ig:c,x:a.ha[c].x,y:a.ha[c].y,wb:!0}),a.ha[c].wb=!0,0<a.ud))for(d=a.C.length-1;0<=d&&!((f=a.C[d])&&f.h&&0>=f.L&&f.xh&&(f=f.xh(c,a.ha[c].x,a.ha[c].y),!0===f));d-=1);}
function Eb(a,b){var c=Hb(a,b),d,f;if(-1!==c&&a.ha[c].wb&&(a.Qf.push({ig:c,x:a.ha[c].x,y:a.ha[c].y,wb:!1}),a.ha[c].wb=!1,0<a.ud))for(d=a.C.length-1;0<=d&&!((f=a.C[d])&&f.h&&0>=f.L&&f.yh&&(f=f.yh(c,a.ha[c].x,a.ha[c].y),!0===f));d-=1);}
function Fb(a,b){var c;if(!(0<a.L)){b.preventDefault();window.focus();c=Math.max(-1,Math.min(1,b.wheelDelta||-b.detail));var d,f;a.Qf.push({ig:0,x:a.ha[0].x,y:a.ha[0].y,wheelDelta:c});if(0<a.ud)for(d=a.C.length-1;0<=d&&!((f=a.C[d])&&f.h&&0>=f.L&&f.no&&(f=f.no(c,a.ha[0].x,a.ha[0].y),!0===f));d-=1);}}
function Ab(a,b){window.addEventListener("keydown",function(a){0<b.L||(-1<[32,37,38,39,40].indexOf(a.keyCode)&&a.preventDefault(),Ib(b,a.keyCode))},!1);window.addEventListener("keyup",function(a){0<b.L||(-1<[32,37,38,39,40].indexOf(a.keyCode)&&a.preventDefault(),Jb(b,a.keyCode))},!1);Kb(a)}function Kb(a){var b;a.fi=[];for(b=0;256>b;b+=1)a.fi[b]=!1;a.Zg=[]}
function Ib(a,b){var c,d;if(!a.fi[b]&&(a.Zg.push({key:b,wb:!0}),a.fi[b]=!0,0<a.$g))for(c=0;c<a.C.length&&!((d=a.C[c])&&d.h&&0>=d.L&&d.lo&&(d=d.lo(b),!0===d));c+=1);}function Jb(a,b){var c,d;if(a.fi[b]&&(a.Zg.push({key:b,wb:!1}),a.fi[b]=!1,0<a.$g))for(c=0;c<a.C.length&&!((d=a.C[c])&&d.h&&0>=d.L&&d.mo&&(d=d.mo(b),!0===d));c+=1);}function Lb(){var a=I,b;for(b=0;b<a.ec.length;b+=1)a.ec[b].paused+=1}
function na(a,b){var c,d=I,f,h;void 0===c&&(c=null);d.si.push({id:a,Eu:b,Hf:c});if(0<d.ni)for(f=0;f<d.C.length&&(!((h=d.C[f])&&h.h&&0>=h.L&&h.oo)||null!==c&&c!==h||(h=h.oo(a,b),!0!==h));f+=1);}
function Mb(a,b){var c=a.kc[b];c.visible&&(void 0!==c.canvas&&c.canvas!==m.canvas&&m.ia(c.canvas),!1!==m.canvas.W||!0===c.jd)&&(0===c.fq&&(0>=c.L&&(c.cc+=c.Du*a.Hg/1E3),1===c.Dm&&1===c.Em&&0===c.na?1===c.alpha?c.b.o(c.cc,c.x,c.y):c.b.dd(c.cc,c.x,c.y,c.alpha):c.b.S(c.cc,c.x,c.y,c.Dm,c.Em,c.na,c.alpha)),1===c.fq&&(1===c.Dm&&1===c.Em&&0===c.na?1===c.alpha?c.font.o(c.text,c.x,c.y):c.font.dd(c.text,c.x,c.y,c.alpha):c.font.S(c.text,c.x,c.y,c.Dm,c.Em,c.na,c.alpha)))}
function Nb(a,b){var c=a.C[b];if(c.visible&&(void 0!==c.canvas&&c.canvas!==m.canvas&&m.ia(c.canvas),(!1!==m.canvas.W||!0===c.jd)&&c.ya))return c.ya()}function Ob(a){for(var b=0,c=0;b<a.C.length||c<a.kc.length;)if(c===a.kc.length){if(!0===Nb(a,b))break;b+=1}else if(b===a.C.length)Mb(a,c),c+=1;else if(a.kc[c].Qa>a.C[b].Qa||a.kc[c].Qa===a.C[b].Qa&&a.kc[c].depth>a.C[b].depth)Mb(a,c),c+=1;else{if(!0===Nb(a,b))break;b+=1}}xb.prototype.pause=function(a){this.L+=1;void 0===a&&(a=!1);this.iq=a};
xb.prototype.Cj=function(){0!==this.L&&(this.ll=Date.now(),this.L-=1)};xb.prototype.Xr=function(){return 0<this.L};window.Hm=0;window.Gm=0;window.aq=0;window.ru=0;window.bq=0;window.tu=60;window.uu=0;window.su=!1;
window.$p=function(){window.Hm=Date.now();window.ru=window.Hm-window.Gm;var a=I,b;if(0<a.L)a.iq&&(Pb(a),Ob(a));else{b=Date.now();"number"!==typeof b&&(b=a.ll);a.Hg=Math.min(a.vw,b-a.ll);a.vh+=a.Hg;""===a.Nc&&(a.Nc="start",ka.be(a.Nc));"start"===a.Nc&&ka.complete(a.Nc)&&(a.Nc="load",ka.be(a.Nc));"load"===a.Nc&&ka.complete(a.Nc)&&(a.Nc="game",ka.be(a.Nc));"undefined"!==typeof G&&$a(a.Hg);var c,d;if(0<a.ji)for(c=0;c<a.C.length&&!((d=a.C[c])&&d.Y&&d.h&&0>=d.L&&!0===d.Y(a.Hg));c+=1);var f,h;if(0!==a.ci.length){if(0<
a.ki)for(d=a.C.length-1;0<=d;d-=1)if((f=a.C[d])&&f.h&&0>=f.L&&f.jo)for(c=0;c<a.ci.length;c+=1)h=a.ci[c],!0!==h.ld&&(h.ld=f.jo(h.x,h.y));a.ci=[]}if(0!==a.Qf.length){if(0<a.he)for(d=a.C.length-1;0<=d;d-=1)if((f=a.C[d])&&f.h&&0>=f.L&&(f.Ob||f.Pb||f.cl))for(c=0;c<a.Qf.length;c+=1)h=a.Qf[c],!0!==h.ld&&(void 0!==h.wheelDelta&&f.cl?h.ld=f.cl(h.wheelDelta,h.x,h.y):h.wb&&f.Ob?h.ld=f.Ob(h.ig,h.x,h.y):void 0!==h.wb&&!h.wb&&f.Pb&&(h.ld=f.Pb(h.ig,h.x,h.y)));a.Qf=[]}if(0!==a.Zg.length){if(0<a.oi)for(d=0;d<a.C.length;d+=
1)if((f=a.C[d])&&f.h&&0>=f.L&&(f.og||f.pg))for(c=0;c<a.Zg.length;c+=1)h=a.Zg[c],!0!==h.ld&&(h.wb&&f.og?h.ld=f.og(h.key):!h.wb&&f.pg&&(h.ld=f.pg(h.key)));a.Zg=[]}c=a.Hg;for(d=a.ai.length=0;d<a.ec.length;d+=1)f=a.ec[d],void 0!==f.id&&0===f.paused&&(0<f.Ng||0<f.Xl)&&(f.Ng-=c,0>=f.Ng&&(a.ai.push({id:f.id,Hf:f.Hf}),0<f.Xl?(f.Xl-=1,f.Ng+=f.time):f.Ng=0));if(0<a.ii&&0<a.ai.length)for(c=0;c<a.C.length;c+=1)if((d=a.C[c])&&d.Yk&&d.h)for(f=0;f<a.ai.length;f+=1)h=a.ai[f],!0===h.ld||null!==h.Hf&&h.Hf!==d||(h.ld=
d.Yk(h.id));if(0<a.pi&&0<a.si.length)for(c=0;c<a.C.length;c+=1)if((f=a.C[c])&&f.Kc&&f.h&&0>=f.L)for(d=0;d<a.si.length;d+=1)h=a.si[d],!0===h.ld||null!==h.Hf&&h.Hf!==f||(h.ld=f.Kc(h.id,h.Eu));a.si.length=0;if(0<a.li)for(c=0;c<a.C.length&&!((d=a.C[c])&&d.Ge&&d.h&&0>=d.L&&!0===d.Ge(a.Hg));c+=1);Pb(a);Ob(a);a.ll=b}window.Gm=Date.now();window.aq=window.Gm-window.Hm;window.bq=Math.max(window.uu,1E3/window.tu-window.aq);window.Vj(window.$p)};window.Vj=function(a){window.setTimeout(a,window.bq)};
window.su||(window.Vj=window.requestAnimationFrame||window.webkitRequestAnimationFrame||window.mozRequestAnimationFrame||window.msRequestAnimationFrame||window.oRequestAnimationFrame||window.Vj);
function Pb(a){function b(a,b){return a.Qa===b.Qa?b.depth-a.depth:a.Qa>b.Qa?-1:1}var c,d;for(c=d=0;c<a.C.length;c+=1)a.C[c]&&(a.C[c].Im&&(a.C[c].Im=!1,a.C[c].h=!0),a.C[d]=a.C[c],d+=1);a.C.length=d;a.ti&&a.C.sort(b);a.ti=!1;for(c=d=0;c<a.kc.length;c+=1)a.kc[c]&&(a.kc[d]=a.kc[c],d+=1);a.kc.length=d;a.Jm&&a.kc.sort(b);a.Jm=!1}
function J(a,b){var c=I;void 0===a.group&&(a.group=0);void 0===a.visible&&(a.visible=!0);void 0===a.h&&(a.h=!0);void 0===a.depth&&(a.depth=0);void 0===a.Qa&&(a.Qa=0);void 0===a.L&&(a.L=0);void 0===a.je&&(a.je=[]);a.Im=!1;void 0!==b&&!1===b&&(a.Im=!0,a.h=!1);c.C.push(a);c.ti=!0;a.Y&&(c.ji+=1);a.jo&&(c.ki+=1);if(a.Ob||a.Pb)c.he+=1;a.cl&&(c.he+=1);if(a.og||a.pg)c.oi+=1;a.Yk&&(c.ii+=1);a.Kc&&(c.pi+=1);a.Ge&&(c.li+=1);a.ko&&(c.mi+=1);if(a.xh||a.yh)c.ud+=1;a.no&&(c.ud+=1);if(a.lo||a.mo)c.$g+=1;a.oo&&(c.ni+=
1);a.Vb&&a.Vb()}function Qb(a,b){var c=I;a.depth!==b&&(c.ti=!0);a.depth=b}function Rb(a,b){var c;b=[].concat(b);void 0===a.je&&(a.je=[]);for(c=b.length-1;0<=c;c-=1)0>a.je.indexOf(b[c])&&a.je.push(b[c])}
function Sb(a,b){var c=[],d,f;if(void 0===b||"all"===b||"master"===b)for(d=0;d<a.C.length;d+=1)f=a.C[d],void 0!==f&&c.push(f);else if("function"===typeof b)for(d=0;d<a.C.length;d+=1)f=a.C[d],void 0!==f&&b(f)&&c.push(f);else for(d=0;d<a.C.length;d+=1)f=a.C[d],void 0!==f&&0<=f.je.indexOf(b)&&c.push(f);return c}function Tb(a){var b=Sb(I,a);for(a=0;a<b.length;a+=1){var c=b[a];c.L+=1}}function Ub(a){var b=Sb(I,a);for(a=0;a<b.length;a+=1){var c=b[a];c.L=Math.max(0,c.L-1)}}
function K(a,b){var c=a.C.indexOf(b);if(!(0>c)){a.C[c].jb&&a.C[c].jb();var d=a.C[c];d.Y&&(a.ji-=1);d.jo&&(a.ki-=1);if(d.Ob||d.Pb)a.he-=1;d.cl&&(a.he-=1);if(d.og||d.pg)a.oi-=1;d.Yk&&(a.ii-=1);d.Kc&&(a.pi-=1);d.Ge&&(a.li-=1);d.ko&&(a.mi-=1);if(d.xh||d.yh)a.ud-=1;d.no&&(a.ud-=1);if(d.lo||d.mo)a.$g-=1;d.oo&&(a.ni-=1);a.C[c]=void 0}}function Vb(a){var b=I,c=Sb(b,a);for(a=0;a<c.length;a+=1)K(b,c[a])}
xb.prototype.c=function(a,b,c,d,f,h,k){void 0===k&&(k=0);this.kc.push({fq:0,b:a,cc:b,Du:c,visible:!0,x:d,y:f,Dm:1,Em:1,na:0,alpha:1,depth:h,Qa:k,L:0,je:[]});this.Jm=!0;return this.kc[this.kc.length-1]};var I=new xb(aa);
function Wb(a,b){var c;this.kind=a;this.t=null;switch(this.kind){case 0:this.t={x:[b.x],y:[b.y]};this.aa=b.x;this.sa=b.y;this.Ma=b.x;this.qb=b.y;break;case 2:this.t={x:[b.x,b.x+b.uc-1,b.x+b.uc-1,b.x,b.x],y:[b.y,b.y,b.y+b.Dc-1,b.y+b.Dc-1,b.y]};this.aa=b.x;this.sa=b.y;this.Ma=b.x+b.uc-1;this.qb=b.y+b.Dc-1;break;case 3:this.t={x:[],y:[]};this.aa=b.x-b.Vl;this.sa=b.y-b.Vl;this.Ma=b.x+b.Vl;this.qb=b.y+b.Vl;break;case 1:this.t={x:[b.Up,b.Vp],y:[b.Wp,b.Xp]};this.aa=Math.min(b.Up,b.Vp);this.sa=Math.min(b.Wp,
b.Xp);this.Ma=Math.max(b.Up,b.Vp);this.qb=Math.max(b.Wp,b.Xp);break;case 4:this.t={x:[],y:[]};this.aa=b.x[0];this.sa=b.y[0];this.Ma=b.x[0];this.qb=b.y[0];for(c=0;c<b.x.length;c+=1)this.t.x.push(b.x[c]),this.t.y.push(b.y[c]),this.aa=Math.min(this.aa,b.x[c]),this.sa=Math.min(this.sa,b.y[c]),this.Ma=Math.max(this.Ma,b.x[c]),this.qb=Math.max(this.qb,b.y[c]);this.t.x.push(b.x[0]);this.t.y.push(b.y[0]);break;default:this.sa=this.aa=0,this.qb=this.Ma=-1}}
function Xb(a,b,c,d){return new Wb(2,{x:a,y:b,uc:c,Dc:d})}function Yb(a,b,c){return new Wb(3,{x:a,y:b,Vl:c})}function Zb(a){var b=1E6,c=-1E6,d=1E6,f=-1E6,h,k,l,n,q;for(h=0;h<a.D;h+=1)k=a.Ue[h]-a.$a,l=k+a.Te[h]-1,n=a.Ve[h]-a.Ua,q=n+a.Se[h]-1,k<b&&(b=k),l>c&&(c=l),n<d&&(d=n),q>f&&(f=q);return new Wb(2,{x:b,y:d,uc:c-b+1,Dc:f-d+1})}e=Wb.prototype;
e.P=function(){var a=new Wb(-1,{}),b;a.kind=this.kind;a.aa=this.aa;a.Ma=this.Ma;a.sa=this.sa;a.qb=this.qb;a.t={x:[],y:[]};for(b=0;b<this.t.x.length;b+=1)a.t.x[b]=this.t.x[b];for(b=0;b<this.t.y.length;b+=1)a.t.y[b]=this.t.y[b];return a};e.translate=function(a,b){var c=this.P(),d;c.aa+=a;c.Ma+=a;c.sa+=b;c.qb+=b;for(d=0;d<c.t.x.length;d+=1)c.t.x[d]+=a;for(d=0;d<c.t.y.length;d+=1)c.t.y[d]+=b;return c};
e.scale=function(a){var b=this.P(),c;b.aa*=a;b.Ma*=a;b.sa*=a;b.qb*=a;for(c=0;c<b.t.x.length;c+=1)b.t.x[c]*=a;for(c=0;c<b.t.y.length;c+=1)b.t.y[c]*=a;return b};
e.rotate=function(a){var b,c,d,f;switch(this.kind){case 0:return b=new g(this.t.x[0],this.t.y[0]),b=b.rotate(a),new Wb(0,{x:b.x,y:b.y});case 1:return b=new g(this.t.x[0],this.t.y[0]),b=b.rotate(a),c=new g(this.t.x[1],this.t.y[1]),c=c.rotate(a),new Wb(1,{Up:b.x,Wp:b.y,Vp:c.x,Xp:c.y});case 3:return b=(this.Ma-this.aa)/2,c=new g(this.aa+b,this.sa+b),c=c.rotate(a),Yb(c.x,c.y,b);default:c=[];d=[];for(f=0;f<this.t.x.length-1;f+=1)b=new g(this.t.x[f],this.t.y[f]),b=b.rotate(a),c.push(b.x),d.push(b.y);return new Wb(4,
{x:c,y:d})}};function $b(a,b,c,d){var f=new g(0,0),h,k=1E9,l=-1E10,n;for(n=0;n<a.t.x.length;n+=1)f.x=b+a.t.x[n],f.y=c+a.t.y[n],h=f.fg(d),k=Math.min(k,h),l=Math.max(l,h);return{min:k,max:l}}function ac(a){var b=new g(0,0),c=new g(0,0),d=[],f;for(f=0;f<a.t.x.length-1;f+=1)b.x=a.t.x[f],b.y=a.t.y[f],c.x=a.t.x[f+1],c.y=a.t.y[f+1],d.push(fa(b.dc(c)));return d}
function bc(a,b,c,d,f,h){var k,l,n,q;if(f+d.Ma<b+a.aa||f+d.aa>b+a.Ma||h+d.qb<c+a.sa||h+d.sa>c+a.qb)return!1;if(2===a.kind&&2===d.kind)return!0;if(3===d.kind)return k=(d.Ma-d.aa)/2,cc(a,b,c,f+d.aa+k,h+d.sa+k,k);if(3===a.kind)return k=(a.Ma-a.aa)/2,cc(d,f,h,b+a.aa+k,c+a.sa+k,k);if(0===d.kind)return dc(a,b,c,f+d.aa,h+d.sa);if(0===a.kind)return dc(d,f,h,b+a.aa,c+a.sa);k=ac(a).concat(ac(d));for(q=0;q<k.length;q+=1)if(l=$b(a,b,c,k[q]),n=$b(d,f,h,k[q]),l.max<n.min||n.max<l.min)return!1;return!0}
function cc(a,b,c,d,f,h){var k,l,n,q,u,B,C;if(d+h<b+a.aa||d-h>b+a.Ma||f+h<c+a.sa||f-h>c+a.qb)return!1;switch(a.kind){case 0:return l=d-(b+a.aa),n=f-(c+a.sa),l*l+n*n<=h*h;case 3:return q=(a.Ma-a.aa)/2,l=d-(b+a.aa+q),n=f-(c+a.sa+q),l*l+n*n<=(q+h)*(q+h);default:q=ac(a);u=k=0;B=1E9;for(C=0;C<a.t.x.length;C+=1)l=b+a.t.x[C]-d,n=c+a.t.y[C]-f,l=l*l+n*n,l<=B&&(k=b+a.t.x[C],u=c+a.t.y[C],B=l);d=new g(d,f);q.push(d.dc(new g(k,u)).normalize());for(C=0;C<q.length;C+=1)if(k=d.fg(q[C]),f=k-h,k+=h,u=$b(a,b,c,q[C]),
k<u.min||u.max<f)return!1;return!0}}function dc(a,b,c,d,f){var h,k,l,n;if(d<b+a.aa||d>b+a.Ma||f<c+a.sa||f>c+a.qb)return!1;switch(a.kind){case 0:case 2:return!0;case 3:return h=(a.Ma-a.aa)/2,d-=b+a.aa+h,f-=c+a.sa+h,d*d+f*f<=h*h;case 1:return h=b+a.t.x[0],k=c+a.t.y[0],b+=a.t.x[1],a=c+a.t.y[1],d===h?f===k:d===b?f===a:1>Math.abs(k+(d-h)*(a-k)/(b-h)-f);case 4:h=ac(a);for(k=0;k<h.length;k+=1)if(l=new g(d,f),l=l.fg(h[k]),n=$b(a,b,c,h[k]),l<n.min||n.max<l)return!1;return!0;default:return!1}}
e.oc=function(a,b,c){var d=m.context;d.fillStyle=c;d.strokeStyle=c;switch(this.kind){case 0:d.fillRect(a+this.aa-1,b+this.sa-1,3,3);break;case 2:d.fillRect(a+this.aa,b+this.sa,this.Ma-this.aa+1,this.qb-this.sa+1);break;case 3:c=(this.Ma-this.aa)/2;d.beginPath();d.arc(a+this.aa+c,b+this.sa+c,c,0,2*Math.PI,!1);d.closePath();d.fill();break;case 1:d.beginPath();d.moveTo(a+this.t.x[0],b+this.t.y[0]);d.lineTo(a+this.t.x[1],b+this.t.y[1]);d.stroke();break;case 4:d.beginPath();d.moveTo(a+this.t.x[0],b+this.t.y[0]);
for(c=1;c<this.t.x.length-1;c+=1)d.lineTo(a+this.t.x[c],b+this.t.y[c]);d.closePath();d.fill()}};function ec(){this.depth=1E7;this.visible=!1;this.h=!0;this.group="Engine";this.ra=[];this.hi=this.L=this.ri=!1;this.Md=1;this.Vc=-1;this.xa=-1E6}e=ec.prototype;e.P=function(){var a=new ec,b;for(b=0;b<this.ra.length;b+=1)a.ra.push({lb:this.ra[b].lb,action:this.ra[b].action});a.hi=this.hi;return a};
e.V=function(a,b){var c,d;if(0===this.ra.length||this.ra[this.ra.length-1].lb<=a)this.ra.push({lb:a,action:b});else{for(c=0;this.ra[c].lb<=a;)c+=1;for(d=this.ra.length;d>c;d-=1)this.ra[d]=this.ra[d-1];this.ra[c]={lb:a,action:b}}this.xa=-1E6};e.start=function(){this.ri=!0;this.L=!1;this.Vc=0>this.Md&&0<this.ra.length?this.ra[this.ra.length-1].lb+1:-1;this.xa=-1E6;K(I,this);J(this)};
e.ip=function(){if(0>this.Md&&0<this.ra.length){var a=this.ra[this.ra.length-1].lb;this.Vc=0>this.Md?a+1:a-1}else this.Vc=0>this.Md?1:-1;this.xa=-1E6};e.stop=function(){this.ri=!1;K(I,this)};e.Ne=function(){return this.ri};e.pause=function(){this.L=!0;K(I,this)};e.Cj=function(){this.L=!1;K(I,this);J(this)};e.paused=function(){return this.ri&&this.L};e.$s=function(a){this.hi=a};
e.Y=function(a){if(this.ri&&!this.L&&0!==this.Md)if(0<this.Md){0>this.xa&&(this.xa=0);for(;this.xa<this.ra.length&&this.ra[this.xa].lb<=this.Vc;)this.xa+=1;for(this.Vc+=this.Md*a;0<=this.xa&&this.xa<this.ra.length&&this.ra[this.xa].lb<=this.Vc;)this.ra[this.xa].action(this.ra[this.xa].lb,this),this.xa+=1;this.xa>=this.ra.length&&(this.hi?this.ip():this.stop())}else{0>this.xa&&(this.xa=this.ra.length-1);for(;0<=this.xa&&this.ra[this.xa].lb>=this.Vc;)this.xa-=1;for(this.Vc+=this.Md*a;0<=this.xa&&this.ra[this.xa].lb>=
this.Vc;)this.ra[this.xa].action(this.ra[this.xa].lb,this),this.xa-=1;0>this.xa&&0>=this.Vc&&(this.hi?this.ip():this.stop())}};function fc(){this.depth=1E7;this.visible=!1;this.h=!0;this.group="Engine";this.jc=[];this.Lf=[];this.clear();this.Yx=!1;J(this)}e=fc.prototype;e.Y=function(){var a,b,c,d,f;if(this.Yx)for(a=0;16>a;a+=1)I.ha[a].wb&&(b=I.ha[a].x,c=I.ha[a].y,d=this.Lf[a],f=this.jc[d],!(0<=d&&f&&f.selected)||f&&dc(f.kb,0,0,b,c)||(Jb(I,f.keyCode),f.selected=!1,this.Lf[a]=-1),this.Ob(a,b,c))};
e.Ob=function(a,b,c){var d;if(!(0<=this.Lf[a]))for(d=0;d<this.jc.length;d+=1){var f;if(f=this.jc[d])f=(f=this.jc[d])?dc(f.kb,0,0,b,c):!1;if(f&&!this.jc[d].selected){Ib(I,this.jc[d].keyCode);this.jc[d].selected=!0;this.Lf[a]=d;break}}};e.Pb=function(a){var b=this.Lf[a];0<=b&&this.jc[b]&&this.jc[b].selected&&(Jb(I,this.jc[b].keyCode),this.jc[b].selected=!1);this.Lf[a]=-1};function gc(a,b,c,d,f,h,k){c=Xb(c,d,f,h);a.jc.push({keyCode:k,kb:c,id:b,selected:!1})}
e.clear=function(){var a;for(a=this.jc.length=0;16>a;a+=1)this.Lf[a]=-1};e.oc=function(a,b,c){var d,f,h,k;for(d=0;d<this.jc.length;d+=1)if(f=this.jc[d])f.selected?f.kb.oc(0,0,b):f.kb.oc(0,0,a),h=(f.kb.aa+f.kb.Ma)/2,k=(f.kb.sa+f.kb.qb)/2,m.Ic("id: "+f.id,h-20,k-10,c,"16px Arial"),m.Ic("key: "+f.keyCode,h-20,k+10,c,"16px Arial")};new ga;function ic(a,b){return b}function L(a,b,c,d){return b+a/d*c}function jc(a,b,c,d,f){void 0===f&&(f=3);return b+c*Math.pow(a/d,f)}
function kc(a,b,c,d){return jc(a,b,c,d,2)}function lc(a,b,c,d){return jc(a,b,c,d,3)}function mc(a,b,c,d){return b+c*jc(d-a,1,-1,d,3)}function nc(a,b,c,d){return b+c*(a<d/2?jc(a,0,.5,d/2,3):jc(d-a,1,-.5,d/2,3))}function oc(a,b,c,d){return b+c*jc(d-a,1,-1,d,4)}function pc(a,b,c,d){return b+c*(a<d/2?0+.5*(1-Math.cos(a/(d/2)*Math.PI/2)):1+-.5*(1-Math.cos((d-a)/(d/2)*Math.PI/2)))}function qc(a,b,c,d){return b+c*(1+-1*(1-Math.sqrt(1-Math.pow((d-a)/d,2))))}
function rc(a,b,c,d,f,h){a=d-a;var k=h;void 0===f&&(f=3);void 0===k&&(k=8);h=Math.sin(2*(1-a/d)*Math.PI*f+Math.PI/2);f=k;void 0===f&&(f=8);k=Math.pow(2,-f);h*=0+(Math.pow(2,f*a/d-f)-k)/(1-k)*1;return b+c*(1+-1*h)}function sc(a,b,c,d,f){void 0===f&&(f=1.70158);return b+c*((1+f)*Math.pow(a/d,3)-f*Math.pow(a/d,2))}function tc(a,b,c,d,f){return b+c*sc(d-a,1,-1,d,f)}
function uc(a){switch(1){case 0:return function(b,c,d,f,h,k,l){return 0>b?c:b>f?c+d:a(b,c,d,f,h,k,l)};case 1:return function(b,c,d,f,h,k,l){return a(b-Math.floor(b/f)*f,c,d,f,h,k,l)};case 2:return function(b,c,d,f,h,k,l){b=0===Math.floor(b/f)%2?a(b-Math.floor(b/f)*f,0,1,f,h,k,l):a(f-b+Math.floor(b/f)*f,0,1,f,h,k,l);return c+d*b};case 3:return function(b,c,d,f,h,k,l){h=a(b-Math.floor(b/f)*f,0,1,f,h,k,l);0!==Math.floor(b/f)%2&&(h=1-h);return c+d*h};case 4:return function(b,c,d,f,h,k,l){var n=Math.floor(b/
f);b=a(b-Math.floor(b/f)*f,0,1,f,h,k,l);return c+d*(n+b)};case 5:return function(b,c,d,f,h,k,l){var n=Math.floor(b/f);b=0===Math.floor(b/f)%2?a(b-Math.floor(b/f)*f,0,1,f,h,k,l):a(f-b+Math.floor(b/f)*f,1,-1,f,h,k,l);return c+d*(n+b)};default:return function(b,c,d,f,h,k,l){return a(b,c,d,f,h,k,l)}}}
function vc(a,b,c){var d,f=0,h=1,k=[0],l=[0];for(void 0===b&&(b=[]);b.length<a.length;)b.push(!1);for(void 0===c&&(c=[]);c.length<a.length;)c.push(1/a.length);for(d=0;d<a.length;d+=1)f+=c[d];for(d=0;d<a.length;d+=1)c[d]/=f;for(d=0;d<a.length;d+=1)l.push(l[d]+c[d]),f=a[d]===ic?0:b[d]?-1:1,k.push(k[d]+f),h=Math.max(h,k[d+1]);return function(d,f,u,B,C,t,s){var v,w;v=a.length-1;for(w=0;w<a.length;w+=1)if(d/B<=l[w+1]){v=w;break}d=a[v](d/B-l[v],0,1,c[v],C,t,s);b[v]&&(d=-d);return f+(k[v]+d)*u/h}}
var M=window.PG_InitSettings||{};M.size=void 0!==M.size?M.size:"big";M.gu=M.usesFullScreen;M.kp="big"===M.size?1:.5;M.kg=20;M.lg=10;M.jf=0;M.Wk=-10;M.th=-20;M.Cc=-30;M.Fe=-40;
function N(a,b){var c;if("number"===typeof a){a:switch(b){case "floor":c=Math.floor(M.kp*a);break a;case "round":c=Math.round(M.kp*a);break a;default:c=M.kp*a}return c}if("[object Array]"===Object.prototype.toString.call(a)){for(c=0;c<a.length;c++)a[c]=N(a[c],b);return a}if("object"===typeof a){for(c in a)a.hasOwnProperty(c)&&(a[c]=N(a[c],b));return a}}function O(a){return"big"===M.size?void 0!==a.big?a.big:a:void 0!==a.small?a.small:a}var P=P||{};P["nl-nl"]=P["nl-nl"]||{};P["nl-nl"].bs_stage="Level";
P["nl-nl"].bs_start="Doel";P["nl-nl"].bs_gameover="Helaas";P["nl-nl"].bs_shootallbubbles="Kun jij het hoogste level behalen?";P["nl-nl"].bs_switch="Wisselen";P["nl-nl"].bs_tap_to_switch_bubbles="#touch{Klik om bubbles te wisselen}{Tik om bubbles te wisselen}";P["nl-nl"].bs_nice="Mooi!";P["nl-nl"].bs_great="Geweldig!";P["nl-nl"].bs_awesome="Fantastisch!";P["nl-nl"].TutorialTitle_1="Speluitleg";P["nl-nl"].TutorialText_0="Schiet met bubbels en vorm groepen van drie of meer bubbels van dezelfde kleur.";
P["nl-nl"].TutorialText_1="Door groepen te vormen verwijder je bubbels.";P["nl-nl"].TutorialTitle_2="Voortgang";P["nl-nl"].TutorialText_2="Elke bubbel is punten waard. Hoe groter de groep, hoe meer punten.";P["nl-nl"].TutorialTitle_3="Levels voltooien";P["nl-nl"].TutorialText_3="Verdien 500 punten om naar het volgende level te gaan.";P["nl-nl"].TutorialTitle_6="Bonussen";P["nl-nl"].TutorialText_6="Dit is een bom. De bom verwijdert omliggende bubbels als hij geraakt wordt.";
P["nl-nl"].TutorialTitle_5="Bonussen";P["nl-nl"].TutorialText_5="Dit zijn kleurenbommen. Ze geven hun kleur aan alle omliggende bubbels.";P["nl-nl"].TutorialTitle_7="Bonussen";P["nl-nl"].TutorialText_7="Dit is een vuurbal. Hij vernietigt alle bubbels op zijn pad.";P["nl-nl"].TutorialTitle_0="Speluitleg";P["nl-nl"].TutorialText_4="Dit zijn blokkers. Een blok kan je alleen wegspelen door de omringende bubbels te verwijderen.";P["nl-nl"].TutorialTitle_4="Blokkers";P["en-us"]=P["en-us"]||{};
P["en-us"].bs_stage="Stage";P["en-us"].bs_start="Goal";P["en-us"].bs_gameover="Game over";P["en-us"].bs_shootallbubbles="Can you reach the highest level?";P["en-us"].bs_switch="Switch";P["en-us"].bs_tap_to_switch_bubbles="#touch{Click to switch bubbles}{Tap to switch bubbles}";P["en-us"].bs_nice="Nice!";P["en-us"].bs_great="Great!";P["en-us"].bs_awesome="Awesome!";P["en-us"].TutorialTitle_1="How to play";P["en-us"].TutorialText_0="Shoot bubbles to form groups of 3 or more of the same color.";
P["en-us"].TutorialText_1="Creating groups will destroy bubbles.";P["en-us"].TutorialTitle_2="Progress";P["en-us"].TutorialText_2="Each bubble is worth points. Bigger groups earn you more points.";P["en-us"].TutorialTitle_3="Completing levels";P["en-us"].TutorialText_3="Earn 500 points to gain a level.";P["en-us"].TutorialTitle_6="Boosters";P["en-us"].TutorialText_6="This is a bomb. It will remove all surrounding bubbles when hit.";P["en-us"].TutorialTitle_5="Boosters";P["en-us"].TutorialText_5="These are color bombs. They will color all surrounding bubbles with their color.";
P["en-us"].TutorialTitle_7="Boosters";P["en-us"].TutorialText_7="This is a fireball. It will destroy all bubbles in its path.";P["en-us"].TutorialTitle_0="How to play";P["en-us"].TutorialText_4="These are blockers. You can get rid of them by removing their surrounding bubbles.";P["en-us"].TutorialTitle_4="Blockers";P["en-gb"]=P["en-gb"]||{};P["en-gb"].bs_stage="Stage";P["en-gb"].bs_start="Goal";P["en-gb"].bs_gameover="Game over";P["en-gb"].bs_shootallbubbles="Can you reach the highest level?";
P["en-gb"].bs_switch="Switch";P["en-gb"].bs_tap_to_switch_bubbles="#touch{Click to switch bubbles}{Tap to switch bubbles}";P["en-gb"].bs_nice="Nice!";P["en-gb"].bs_great="Great!";P["en-gb"].bs_awesome="Awesome!";P["en-gb"].TutorialTitle_1="How to play";P["en-gb"].TutorialText_0="Shoot bubbles to form groups of 3 or more of the same color.";P["en-gb"].TutorialText_1="Creating groups will destroy bubbles.";P["en-gb"].TutorialTitle_2="Progress";P["en-gb"].TutorialText_2="Each bubble is worth points. Bigger groups earn you more points.";
P["en-gb"].TutorialTitle_3="Completing levels";P["en-gb"].TutorialText_3="Earn 500 points to gain a level.";P["en-gb"].TutorialTitle_6="Boosters";P["en-gb"].TutorialText_6="This is a bomb. It will remove all surrounding bubbles when hit.";P["en-gb"].TutorialTitle_5="Boosters";P["en-gb"].TutorialText_5="These are colour bombs. They will colour all surrounding bubbles with their colour.";P["en-gb"].TutorialTitle_7="Boosters";P["en-gb"].TutorialText_7="This is a fireball. It will destroy all bubbles in its path.";
P["en-gb"].TutorialTitle_0="How to play";P["en-gb"].TutorialText_4="These are blockers. You can get rid of them by removing their surrounding bubbles.";P["en-gb"].TutorialTitle_4="Blockers";P["de-de"]=P["de-de"]||{};P["de-de"].bs_stage="Stufe";P["de-de"].bs_start="Ziel";P["de-de"].bs_gameover="ENDE!";P["de-de"].bs_shootallbubbles="Kannst du das h\u00f6chste Level erreichen?";P["de-de"].bs_switch="Schalter";P["de-de"].bs_tap_to_switch_bubbles="#touch{Blasen wechseln: Klicken}{Blasen wechseln: Tippen}";
P["de-de"].bs_nice="Toll!";P["de-de"].bs_great="Super!";P["de-de"].bs_awesome="Fantastisch!";P["de-de"].TutorialTitle_1="So wird gespielt";P["de-de"].TutorialText_0="Schie\u00dfe Blasen nach oben, um Gruppen aus mindestens drei gleichfarbigen Blasen zu bilden.";P["de-de"].TutorialText_1="Wird eine Gruppe gebildet, zerst\u00f6rt das die Blasen.";P["de-de"].TutorialTitle_2="Fortschritt";P["de-de"].TutorialText_2="Jede Blase bringt dir Punkte ein. Gr\u00f6\u00dfere Gruppen sind mehr Punkte wert.";
P["de-de"].TutorialTitle_3="Levels abschlie\u00dfen";P["de-de"].TutorialText_3="Verdiene dir 500 Punkte, um ein Level aufzusteigen.";P["de-de"].TutorialTitle_6="Extras";P["de-de"].TutorialText_6="Das ist eine Bombe. Sie entfernt bei einem Treffer alle Blasen, von denen sie umgeben ist.";P["de-de"].TutorialTitle_5="Extras";P["de-de"].TutorialText_5="Das sind Farbbomben. Sie f\u00e4rben alle sie umgebenden Blasen in ihre Farbe um.";P["de-de"].TutorialTitle_7="Extras";P["de-de"].TutorialText_7="Das ist ein Feuerball. Er zerst\u00f6rt alle Blasen in seiner Flugbahn.";
P["de-de"].TutorialTitle_0="So wird gespielt";P["de-de"].TutorialText_4="Das sind Blocker. Blocker wirst du los, indem du die Blasen entfernst, von denen sie umgeben sind.";P["de-de"].TutorialTitle_4="Blocker";P["fr-fr"]=P["fr-fr"]||{};P["fr-fr"].bs_stage="Sc\u00e8ne";P["fr-fr"].bs_start="Objectif";P["fr-fr"].bs_gameover="Partie termin\u00e9e";P["fr-fr"].bs_shootallbubbles="Atteindrez-vous le dernier niveau ?";P["fr-fr"].bs_switch="\u00c9changer";P["fr-fr"].bs_tap_to_switch_bubbles="#touch{Cliquez pour \u00e9changer les bulles}{Touchez pour \u00e9changer les bulles}";
P["fr-fr"].bs_nice="Joli !";P["fr-fr"].bs_great="G\u00e9nial !";P["fr-fr"].bs_awesome="Excellent !";P["fr-fr"].TutorialTitle_1="Comment jouer";P["fr-fr"].TutorialText_0="Tirez vos bulles pour former des groupes de 3 (ou plus) de la m\u00eame couleur.";P["fr-fr"].TutorialText_1="Cr\u00e9er des groupes de bulles les fait dispara\u00eetre.";P["fr-fr"].TutorialTitle_2="Progression";P["fr-fr"].TutorialText_2="Chaque bulle rapporte des points. Plus le groupe est grand, plus vous gagnez de points.";
P["fr-fr"].TutorialTitle_3="Terminer les niveaux";P["fr-fr"].TutorialText_3="Atteignez 500 points pour passer au niveau suivant.";P["fr-fr"].TutorialTitle_6="Bonus";P["fr-fr"].TutorialText_6="Ceci est une bombe. Elle fait dispara\u00eetre toutes les bulles proches.";P["fr-fr"].TutorialTitle_5="Bonus";P["fr-fr"].TutorialText_5="Voici des bombes de couleur. Elles changent la couleur de toutes les bulles avoisinantes.";P["fr-fr"].TutorialTitle_7="Bonus";P["fr-fr"].TutorialText_7="Ceci est une boule de feu. Elle d\u00e9truit toutes les bulles sur son chemin.";
P["fr-fr"].TutorialTitle_0="Comment jouer";P["fr-fr"].TutorialText_4="Voici des cailloux. Vous pouvez vous en d\u00e9barrasser en \u00e9clatant les bulles situ\u00e9es autour.";P["fr-fr"].TutorialTitle_4="Cailloux";P["pt-br"]=P["pt-br"]||{};P["pt-br"].bs_stage="Fase";P["pt-br"].bs_start="Objetivo";P["pt-br"].bs_gameover="Fim do jogo";P["pt-br"].bs_shootallbubbles="Tente chegar ao n\u00edvel m\u00e1ximo!";P["pt-br"].bs_switch="Trocar";P["pt-br"].bs_tap_to_switch_bubbles="#touch{Clique para trocar as bolhas.}{Toque para trocar as bolhas.}";
P["pt-br"].bs_nice="Legal!";P["pt-br"].bs_great="\u00d3timo!";P["pt-br"].bs_awesome="Incr\u00edvel!";P["pt-br"].TutorialTitle_1="Como jogar";P["pt-br"].TutorialText_0="Atire nas bolhas para formar grupos de 3 ou mais da mesma cor.";P["pt-br"].TutorialText_1="Forme grupos para destruir as bolhas.";P["pt-br"].TutorialTitle_2="Progresso";P["pt-br"].TutorialText_2="Cada bolha vale pontos. Grupos maiores valem mais pontos.";P["pt-br"].TutorialTitle_3="Passar de n\u00edvel";P["pt-br"].TutorialText_3="Fa\u00e7a 500 pontos para passar de fase.";
P["pt-br"].TutorialTitle_6="Refor\u00e7os";P["pt-br"].TutorialText_6="Esta \u00e9 a bomba. Quando \u00e9 atingida, remove todas as bolhas ao redor.";P["pt-br"].TutorialTitle_5="Refor\u00e7os";P["pt-br"].TutorialText_5="Estas s\u00e3o bombas de cor. Elas deixam as bolhas ao redor com a mesma cor delas.";P["pt-br"].TutorialTitle_7="Refor\u00e7os";P["pt-br"].TutorialText_7="Esta \u00e9 a bola de fogo. Ela destr\u00f3i todas as bolhas em seu caminho.";P["pt-br"].TutorialTitle_0="Como jogar";
P["pt-br"].TutorialText_4="Estes s\u00e3o os bloqueadores. Remova as bolhas ao redor, para se livrar deles.";P["pt-br"].TutorialTitle_4="Bloqueadores";P["es-es"]=P["es-es"]||{};P["es-es"].bs_stage="Fase";P["es-es"].bs_start="Objetivo";P["es-es"].bs_gameover="Fin del juego";P["es-es"].bs_shootallbubbles="\u00bfPuedes llegar al \u00faltimo nivel?";P["es-es"].bs_switch="Cambiar";P["es-es"].bs_tap_to_switch_bubbles="#touch{Haz clic para cambiar de burbuja.}{Toca para cambiar de burbuja.}";
P["es-es"].bs_nice="\u00a1Guay!";P["es-es"].bs_great="\u00a1Genial!";P["es-es"].bs_awesome="\u00a1Estupendo!";P["es-es"].TutorialTitle_1="C\u00f3mo jugar";P["es-es"].TutorialText_0="Dispara burbujas para crear grupos de 3 o m\u00e1s del mismo color.";P["es-es"].TutorialText_1="Al crear grupos, eliminas las burbujas.";P["es-es"].TutorialTitle_2="Progreso";P["es-es"].TutorialText_2="Cada burbuja te da puntos. Cuanto mayor sea el grupo, m\u00e1s puntos dan.";P["es-es"].TutorialTitle_3="Completar niveles";
P["es-es"].TutorialText_3="Gana 500 puntos para subir de nivel.";P["es-es"].TutorialTitle_6="Potenciadores";P["es-es"].TutorialText_6="Esto es una bomba. Eliminar\u00e1 las burbujas a su alrededor si le das.";P["es-es"].TutorialTitle_5="Potenciadores";P["es-es"].TutorialText_5="Estas son bombas de color. Hacen que las burbujas cercanas sean de su color.";P["es-es"].TutorialTitle_7="Potenciadores";P["es-es"].TutorialText_7="Esto es una bola de fuego. Destruye las burbujas en su camino.";
P["es-es"].TutorialTitle_0="C\u00f3mo jugar";P["es-es"].TutorialText_4="Esto es un bloqueo. Para librarte de \u00e9l, elimina las burbujas de alrededor.";P["es-es"].TutorialTitle_4="Bloqueos";P["tr-tr"]=P["tr-tr"]||{};P["tr-tr"].bs_stage="B\u00f6l\u00fcm";P["tr-tr"].bs_start="Hedef";P["tr-tr"].bs_gameover="Oyun bitti";P["tr-tr"].bs_shootallbubbles="En y\u00fcksek seviyeye ula\u015fabilir misin?";P["tr-tr"].bs_switch="De\u011fi\u015ftir";P["tr-tr"].bs_tap_to_switch_bubbles="#touch{Balonlar\u0131 de\u011fi\u015ftirmek i\u00e7in t\u0131kla}{Balonlar\u0131 de\u011fi\u015ftirmek i\u00e7in dokun}";
P["tr-tr"].bs_nice="G\u00fczel!";P["tr-tr"].bs_great="Harika!";P["tr-tr"].bs_awesome="Muhte\u015fem!";P["tr-tr"].TutorialTitle_1="Nas\u0131l oynan\u0131r";P["tr-tr"].TutorialText_0="3'l\u00fc ya da daha fazla ayn\u0131 renkten gruplar olu\u015fturmak i\u00e7in balonlar\u0131 vur.";P["tr-tr"].TutorialText_1="Gruplar olu\u015fturmak balonlar\u0131 yok eder.";P["tr-tr"].TutorialTitle_2="\u0130lerleme";P["tr-tr"].TutorialText_2="Her balonun puan de\u011feri vard\u0131r. Daha b\u00fcy\u00fck gruplar daha fazla puan kazand\u0131r\u0131r.";
P["tr-tr"].TutorialTitle_3="Seviyeleri tamamlama";P["tr-tr"].TutorialText_3="Seviye atlamak i\u00e7in 500 puan kazan.";P["tr-tr"].TutorialTitle_6="Destekler";P["tr-tr"].TutorialText_6="Bu bir bombad\u0131r. Vuruldu\u011funda etraflar\u0131ndaki balonlar\u0131 kald\u0131r\u0131r.";P["tr-tr"].TutorialTitle_5="Destekler";P["tr-tr"].TutorialText_5="Bunlar renkli bombalard\u0131r. Etraflar\u0131ndaki balonlar\u0131 kendi renklerine boyarlar.";P["tr-tr"].TutorialTitle_7="Destekler";
P["tr-tr"].TutorialText_7="Bu bir alev topu. Yolundaki t\u00fcm balonlar\u0131 yok eder.";P["tr-tr"].TutorialTitle_0="Nas\u0131l oynan\u0131r";P["tr-tr"].TutorialText_4="Bunlar engelleyenler! Bunlardan kurtulmak i\u00e7in etraflar\u0131ndaki balonlar\u0131 kald\u0131r.";P["tr-tr"].TutorialTitle_4="Engelleyenler";P["ru-ru"]=P["ru-ru"]||{};P["ru-ru"].bs_stage="\u042d\u0442\u0430\u043f";P["ru-ru"].bs_start="\u0426\u0435\u043b\u044c";P["ru-ru"].bs_gameover="\u041a\u043e\u043d\u0435\u0446 \u0438\u0433\u0440\u044b";
P["ru-ru"].bs_shootallbubbles="\u0414\u043e\u0431\u0435\u0440\u0435\u0442\u0435\u0441\u044c \u043b\u0438 \u0432\u044b \u0434\u043e \u0441\u0430\u043c\u043e\u0433\u043e \u0432\u044b\u0441\u043e\u043a\u043e\u0433\u043e \u0443\u0440\u043e\u0432\u043d\u044f?";P["ru-ru"].bs_switch="\u0421\u043c\u0435\u043d\u0430 \u0446\u0432\u0435\u0442\u0430";P["ru-ru"].bs_tap_to_switch_bubbles="#touch{\u0429\u0435\u043b\u043a\u043d\u0438\u0442\u0435, \u0447\u0442\u043e\u0431\u044b \u043f\u043e\u043c\u0435\u043d\u044f\u0442\u044c \u043f\u0443\u0437\u044b\u0440\u0438 \u043c\u0435\u0441\u0442\u0430\u043c\u0438}{\u041a\u043e\u0441\u043d\u0438\u0442\u0435\u0441\u044c, \u0447\u0442\u043e\u0431\u044b \u043f\u043e\u043c\u0435\u043d\u044f\u0442\u044c \u043f\u0443\u0437\u044b\u0440\u0438 \u043c\u0435\u0441\u0442\u0430\u043c\u0438}";
P["ru-ru"].bs_nice="\u0417\u0434\u043e\u0440\u043e\u0432\u043e!";P["ru-ru"].bs_great="\u041e\u0442\u043b\u0438\u0447\u043d\u043e!";P["ru-ru"].bs_awesome="\u041a\u0440\u0443\u0442\u043e!";P["ru-ru"].TutorialTitle_1="\u041a\u0430\u043a \u0438\u0433\u0440\u0430\u0442\u044c";P["ru-ru"].TutorialText_0="\u0421\u0442\u0440\u0435\u043b\u044f\u0439\u0442\u0435 \u043f\u0443\u0437\u044b\u0440\u044f\u043c\u0438, \u0447\u0442\u043e\u0431\u044b \u0441\u043e\u0435\u0434\u0438\u043d\u0438\u0442\u044c 3 \u0438 \u0431\u043e\u043b\u044c\u0448\u0435 \u043f\u0443\u0437\u044b\u0440\u0435\u0439 \u043e\u0434\u043d\u043e\u0433\u043e \u0446\u0432\u0435\u0442\u0430.";
P["ru-ru"].TutorialText_1="\u0421\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u043d\u044b\u0435 \u043f\u0443\u0437\u044b\u0440\u0438 \u043b\u043e\u043f\u0430\u044e\u0442\u0441\u044f.";P["ru-ru"].TutorialTitle_2="\u0425\u043e\u0434 \u0438\u0433\u0440\u044b";P["ru-ru"].TutorialText_2="\u0417\u0430 \u043a\u0430\u0436\u0434\u044b\u0439 \u043f\u0443\u0437\u044b\u0440\u044c \u0432\u044b \u043f\u043e\u043b\u0443\u0447\u0430\u0435\u0442\u0435 \u043e\u0447\u043a\u0438. \u0427\u0435\u043c \u0431\u043e\u043b\u044c\u0448\u0435 \u0433\u0440\u0443\u043f\u043f\u0430, \u0442\u0435\u043c \u0431\u043e\u043b\u044c\u0448\u0435 \u043e\u0447\u043a\u043e\u0432 \u0432\u044b \u0437\u0430\u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442\u0435.";
P["ru-ru"].TutorialTitle_3="\u041f\u0440\u043e\u0445\u043e\u0436\u0434\u0435\u043d\u0438\u0435 \u0443\u0440\u043e\u0432\u043d\u0435\u0439";P["ru-ru"].TutorialText_3="\u0417\u0430\u0440\u0430\u0431\u043e\u0442\u0430\u0439\u0442\u0435 500 \u043e\u0447\u043a\u043e\u0432, \u0447\u0442\u043e\u0431\u044b \u043f\u043e\u043b\u0443\u0447\u0438\u0442\u044c \u043d\u043e\u0432\u044b\u0439 \u0443\u0440\u043e\u0432\u0435\u043d\u044c.";P["ru-ru"].TutorialTitle_6="\u0411\u043e\u043d\u0443\u0441\u044b";
P["ru-ru"].TutorialText_6="\u042d\u0442\u043e \u0431\u043e\u043c\u0431\u0430. \u041f\u0440\u0438 \u0432\u0437\u0440\u044b\u0432\u0435 \u043e\u043d\u0430 \u0443\u043d\u0438\u0447\u0442\u043e\u0436\u0430\u0435\u0442 \u0432\u0441\u0435 \u043e\u043a\u0440\u0443\u0436\u0430\u044e\u0449\u0438\u0435 \u043f\u0443\u0437\u044b\u0440\u0438.";P["ru-ru"].TutorialTitle_5="\u0411\u043e\u043d\u0443\u0441\u044b";P["ru-ru"].TutorialText_5="\u042d\u0442\u043e \u0446\u0432\u0435\u0442\u043d\u044b\u0435 \u0431\u043e\u043c\u0431\u044b. \u041e\u043d\u0438 \u043f\u0435\u0440\u0435\u043a\u0440\u0430\u0448\u0438\u0432\u0430\u044e\u0442 \u0432\u0441\u0435 \u043f\u0443\u0437\u044b\u0440\u0438 \u0440\u044f\u0434\u043e\u043c \u0432 \u0441\u0432\u043e\u0439 \u0446\u0432\u0435\u0442.";
P["ru-ru"].TutorialTitle_7="\u0411\u043e\u043d\u0443\u0441\u044b";P["ru-ru"].TutorialText_7="\u042d\u0442\u043e \u043e\u0433\u043d\u0435\u043d\u043d\u044b\u0439 \u0448\u0430\u0440. \u041e\u043d \u0443\u043d\u0438\u0447\u0442\u043e\u0436\u0430\u0435\u0442 \u0432\u0441\u0435 \u043f\u0443\u0437\u044b\u0440\u0438 \u043d\u0430 \u0441\u0432\u043e\u0435\u043c \u043f\u0443\u0442\u0438.";P["ru-ru"].TutorialTitle_0="\u041a\u0430\u043a \u0438\u0433\u0440\u0430\u0442\u044c";P["ru-ru"].TutorialText_4="\u042d\u0442\u043e \u0431\u043b\u043e\u043a\u0430\u0442\u043e\u0440\u044b. \u0418\u0437\u0431\u0430\u0432\u0438\u0442\u044c\u0441\u044f \u043e\u0442 \u043d\u0438\u0445 \u043c\u043e\u0436\u043d\u043e, \u0443\u0431\u0440\u0430\u0432 \u043e\u043a\u0440\u0443\u0436\u0430\u044e\u0449\u0438\u0435 \u043f\u0443\u0437\u044b\u0440\u0438.";
P["ru-ru"].TutorialTitle_4="\u0411\u043b\u043e\u043a\u0430\u0442\u043e\u0440\u044b";P["ar-eg"]=P["ar-eg"]||{};P["ar-eg"].bs_stage="\u0627\u0644\u0645\u0631\u062d\u0644\u0629";P["ar-eg"].bs_start="\u0627\u0644\u0647\u062f\u0641";P["ar-eg"].bs_gameover="\u0627\u0646\u062a\u0647\u062a \u0627\u0644\u0644\u0639\u0628\u0629";P["ar-eg"].bs_shootallbubbles="\u0647\u0644 \u064a\u0645\u0643\u0646\u0643 \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0623\u0639\u0644\u0649 \u0645\u0633\u062a\u0648\u0649\u061f";
P["ar-eg"].bs_switch="\u062a\u0628\u062f\u064a\u0644";P["ar-eg"].bs_tap_to_switch_bubbles="#touch{\u0627\u0646\u0642\u0631 \u0644\u062a\u0628\u062f\u064a\u0644 \u0627\u0644\u0641\u0642\u0627\u0639\u0627\u062a}{\u0627\u0644\u0645\u0633 \u0644\u062a\u0628\u062f\u064a\u0644 \u0627\u0644\u0641\u0642\u0627\u0639\u0627\u062a}";P["ar-eg"].bs_nice="\u062c\u064a\u062f!";P["ar-eg"].bs_great="\u0639\u0638\u064a\u0645!";P["ar-eg"].bs_awesome="\u0631\u0627\u0626\u0639!";P["ar-eg"].TutorialTitle_1="\u0637\u0631\u064a\u0642\u0629 \u0627\u0644\u0644\u0639\u0628";
P["ar-eg"].TutorialText_0="\u0642\u0645 \u0628\u0642\u0630\u0641 \u0627\u0644\u0641\u0642\u0627\u0639\u0627\u062a \u0644\u062a\u0643\u0648\u064a\u0646 \u0645\u062c\u0645\u0648\u0639\u0627\u062a \u0645\u0646 \u062b\u0644\u0627\u062b \u0641\u0642\u0627\u0639\u0627\u062a \u0623\u0648 \u0643\u062b\u0631 \u0645\u0646 \u0646\u0641\u0633 \u0627\u0644\u0644\u0648\u0646.";P["ar-eg"].TutorialText_1="\u064a\u0624\u062f\u064a \u062a\u0643\u0648\u064a\u0646 \u0645\u062c\u0645\u0648\u0639\u0627\u062a \u0627\u0644\u0641\u0642\u0627\u0639\u0627\u062a \u0625\u0644\u0649 \u062a\u062f\u0645\u064a\u0631\u0647\u0627.";
P["ar-eg"].TutorialTitle_2="\u0627\u0644\u062a\u0642\u062f\u0645";P["ar-eg"].TutorialText_2="\u062a\u0633\u0627\u0648\u064a \u0643\u0644 \u0641\u0642\u0627\u0639\u0629 \u0639\u062f\u062f\u064b\u0627 \u0645\u0646 \u0627\u0644\u0646\u0642\u0627\u0637. \u0648\u0643\u0644\u0645\u0627 \u0632\u0627\u062f \u0639\u062f\u062f \u0627\u0644\u0641\u0642\u0627\u0639\u0627\u062a \u0641\u064a \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629\u060c \u0632\u0627\u062f \u0639\u062f\u062f \u0627\u0644\u0646\u0642\u0627\u0637 \u0627\u0644\u062a\u0628 \u062a\u062c\u0645\u0639\u0647\u0627.";
P["ar-eg"].TutorialTitle_3="\u0625\u0643\u0645\u0627\u0644 \u0627\u0644\u0645\u0633\u062a\u0648\u064a\u0627\u062a";P["ar-eg"].TutorialText_3="\u0627\u062c\u0645\u0639 500 \u0646\u0642\u0637\u0629 \u0644\u0644\u0641\u0648\u0632 \u0628\u0645\u0633\u062a\u0648\u0649.";P["ar-eg"].TutorialTitle_6="\u0645\u064a\u0632\u0627\u062a";P["ar-eg"].TutorialText_6="\u0647\u0630\u0647 \u0642\u0646\u0628\u0644\u0629. \u0633\u062a\u0642\u0648\u0645 \u0628\u0625\u0632\u0627\u0644\u0629 \u0643\u0644 \u0627\u0644\u0641\u0642\u0627\u0639\u0627\u062a \u0627\u0644\u0645\u062d\u064a\u0637\u0629 \u0628\u0647\u0627 \u0639\u0646\u062f \u0636\u0631\u0628\u0647\u0627.";
P["ar-eg"].TutorialTitle_5="\u0645\u064a\u0632\u0627\u062a";P["ar-eg"].TutorialText_5="\u0647\u0630\u0647 \u0642\u0646\u0627\u0628\u0644 \u0627\u0644\u0644\u0648\u0646. \u0633\u062a\u0642\u0648\u0645 \u0627\u0644\u0642\u0646\u0627\u0628\u0644 \u0628\u062a\u0644\u0648\u064a\u0646 \u0643\u0644 \u0627\u0644\u0641\u0642\u0627\u0639\u0627\u062a \u0627\u0644\u0645\u062d\u064a\u0637\u0629 \u0628\u0647\u0627 \u0628\u0644\u0648\u0646\u0647\u0627.";P["ar-eg"].TutorialTitle_7="\u0645\u064a\u0632\u0627\u062a";
P["ar-eg"].TutorialText_7="\u0647\u0630\u0647 \u0643\u0631\u0629 \u0646\u0627\u0631\u064a\u0629. \u0633\u062a\u0642\u0648\u0645 \u0628\u062a\u062f\u0645\u064a\u0631 \u0643\u0644 \u0627\u0644\u0641\u0642\u0627\u0639\u0627\u062a \u0627\u0644\u0645\u0648\u062c\u0648\u062f\u0629 \u0641\u064a \u0645\u0633\u0627\u0631\u0647\u0627.";P["ar-eg"].TutorialTitle_0="\u0637\u0631\u064a\u0642\u0629 \u0627\u0644\u0644\u0639\u0628";P["ar-eg"].TutorialText_4="\u0647\u0630\u0647 \u0635\u062e\u0648\u0631. \u064a\u0645\u0643\u0646\u0643 \u0627\u0644\u062a\u062e\u0644\u0635 \u0645\u0646\u0647\u0627 \u0639\u0646 \u0637\u0631\u064a\u0642 \u0625\u0632\u0627\u0644\u0629 \u0627\u0644\u0641\u0642\u0627\u0639\u0627\u062a \u0627\u0644\u0645\u062d\u064a\u0637\u0629 \u0628\u0647\u0627.";
P["ar-eg"].TutorialTitle_4="\u0635\u062e\u0648\u0631";P["ko-kr"]=P["ko-kr"]||{};P["ko-kr"].bs_stage="Stage";P["ko-kr"].bs_start="\ubaa9\ud45c";P["ko-kr"].bs_gameover="Game over";P["ko-kr"].bs_shootallbubbles="\ucd5c\uace0 \ub808\ubca8\uc5d0 \ub3c4\ub2ec\ud560 \uc218 \uc788\ub098\uc694?";P["ko-kr"].bs_switch="\uc804\ud658";P["ko-kr"].bs_tap_to_switch_bubbles="#touch{\ubc84\ube14\uc744 \ubc14\uafb8\ub824\uba74 \uc804\ud658\uc744 \ud074\ub9ad\ud558\uc138\uc694}{\ubc84\ube14\uc744 \ubc14\uafb8\ub824\uba74 \uc804\ud658\uc744 \ub204\ub974\uc138\uc694}";
P["ko-kr"].bs_nice="\uc88b\uc544\uc694!";P["ko-kr"].bs_great="\ud6cc\ub96d\ud574!";P["ko-kr"].bs_awesome="\uba4b\uc9c0\uad70\uc694!";P["ko-kr"].TutorialTitle_1="\uac8c\uc784 \ubc29\ubc95";P["ko-kr"].TutorialText_0="3\uac1c \uc774\uc0c1\uc758 \uac19\uc740 \uc0c9 \uadf8\ub8f9\uc744 \ud5a5\ud574 \uc3d8\uc138\uc694.";P["ko-kr"].TutorialText_1="\uadf8\ub8f9\uc774 \ub9cc\ub4e4\uba74 \ubc84\ube14\uc744 \ud30c\uad34\ud569\ub2c8\ub2e4.";P["ko-kr"].TutorialTitle_2="\uc9c4\ud589";P["ko-kr"].TutorialText_2="\uac01 \ubc84\ube14\uc774 \uc810\uc218\uac00 \ub429\ub2c8\ub2e4. \ub354 \ud070 \uadf8\ub8f9\uc740 \ub354 \ub9ce\uc740 \uc810\uc218\ub97c \ud68d\ub4dd\ud569\ub2c8\ub2e4.";
P["ko-kr"].TutorialTitle_3="\ub808\ubca8 \uc644\ub8cc\ud558\uae30";P["ko-kr"].TutorialText_3="\ub808\ubca8\uc744 \ud655\ubcf4\ud558\ub824\uba74 500\uc810\uc744 \ud68d\ub4dd\ud558\uc138\uc694.";P["ko-kr"].TutorialTitle_6="\ubd80\uc2a4\ud130";P["ko-kr"].TutorialText_6="\ud3ed\ud0c4\uc785\ub2c8\ub2e4. \ub9de\ucd94\uba74 \uc8fc\uc704 \ubaa8\ub4e0 \ubc84\ube14\uc744 \uc81c\uac70\ud569\ub2c8\ub2e4.";P["ko-kr"].TutorialTitle_5="\ubd80\uc2a4\ud130";P["ko-kr"].TutorialText_5="\uc0c9\uae54 \ud3ed\ud0c4\uc785\ub2c8\ub2e4. \uc8fc\ubcc0\uc758 \ubc84\ube14\uc744 \uac19\uc740 \uc0c9\uc73c\ub85c \ubc14\uafc9\ub2c8\ub2e4.";
P["ko-kr"].TutorialTitle_7="\ubd80\uc2a4\ud130";P["ko-kr"].TutorialText_7="\ubd88 \ub369\uc5b4\ub9ac\uc785\ub2c8\ub2e4. \uc9c0\ub098\uac04 \uc790\ub9ac\uc758 \ubaa8\ub4e0 \ubc84\ube14\uc744 \ud30c\uad34\ud569\ub2c8\ub2e4.";P["ko-kr"].TutorialTitle_0="\uac8c\uc784 \ubc29\ubc95";P["ko-kr"].TutorialText_4="\ucc28\ub2e8\uc81c\uc785\ub2c8\ub2e4. \uc8fc\ubcc0 \ubc84\ube14\uc744 \uc81c\uac70\ud574 \ud30c\uad34\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.";P["ko-kr"].TutorialTitle_4="\ucc28\ub2e8\uc81c";
P["jp-jp"]=P["jp-jp"]||{};P["jp-jp"].bs_stage="\u30ec\u30d9\u30eb";P["jp-jp"].bs_start="\u30b4\u30fc\u30eb";P["jp-jp"].bs_gameover="\u30b2\u30fc\u30e0\u30aa\u30fc\u30d0\u30fc";P["jp-jp"].bs_shootallbubbles="\u30cf\u30a4\u30b9\u30b3\u30a2\u3092\u76ee\u6307\u3057\u3066\u306d\uff01";P["jp-jp"].bs_switch="\u4ea4\u63db";P["jp-jp"].bs_tap_to_switch_bubbles="#touch{\u30bf\u30c3\u30d7\u3057\u3066\u30d0\u30d6\u30eb\u3092\u4ea4\u63db\u3057\u3066\u304f\u3060\u3055\u3044\u3002}{\u30bf\u30c3\u30d7\u3067\u30d0\u30d6\u30eb\u3092\u4ea4\u63db}";
P["jp-jp"].bs_nice="Nice!";P["jp-jp"].bs_great="Great!";P["jp-jp"].bs_awesome="Awesome!";P["jp-jp"].TutorialTitle_1="\u3042\u305d\u3073\u65b9";P["jp-jp"].TutorialText_0="\u540c\u3058\u8272\u306e\u30d0\u30d6\u30eb\u304c\uff13\u3064\u4ee5\u4e0a\u30de\u30c3\u30c1\u3059\u308b\u5834\u6240\u306b\u3001\n\u30d0\u30d6\u30eb\u3092\u6483\u3063\u3066\u304f\u3060\u3055\u3044\u3002";P["jp-jp"].TutorialText_1="\u30de\u30c3\u30c1\u3059\u308b\u3068\u30d0\u30d6\u30eb\u304c\u6d88\u3048\u307e\u3059\u3002";
P["jp-jp"].TutorialTitle_2="\u30dd\u30a4\u30f3\u30c8";P["jp-jp"].TutorialText_2="\u30d0\u30d6\u30eb\u3092\u6d88\u3059\u3068\u30dd\u30a4\u30f3\u30c8\u304c\u5f97\u3089\u308c\u307e\u3059\u3002\n\u591a\u304f\u306e\u30d0\u30d6\u30eb\u3092\u4e00\u5ea6\u306b\u6d88\u3059\u3068\u3001\n\u3088\u308a\u591a\u304f\u306e\u30dd\u30a4\u30f3\u30c8\u3092\u7372\u5f97\u3067\u304d\u307e\u3059\u3002";P["jp-jp"].TutorialTitle_3="\u30ec\u30d9\u30eb\u30af\u30ea\u30a2";P["jp-jp"].TutorialText_3="500\u30dd\u30a4\u30f3\u30c8\u3092\u7372\u5f97\u3059\u308b\u3068\u6b21\u306e\u30ec\u30d9\u30eb\u3078\u9032\u3081\u307e\u3059\u3002";
P["jp-jp"].TutorialTitle_6="\u304a\u52a9\u3051\u30a2\u30a4\u30c6\u30e0";P["jp-jp"].TutorialText_6="\u7206\u5f3e\u3092\u6483\u3064\u3068\u3001\n\u307e\u308f\u308a\u306e\u30d0\u30eb\u30fc\u30f3\u3092\u4e00\u5ea6\u306b\u6d88\u3059\u3053\u3068\u304c\u3067\u304d\u307e\u3059\u3002";P["jp-jp"].TutorialTitle_5="\u304a\u52a9\u3051\u30a2\u30a4\u30c6\u30e0";P["jp-jp"].TutorialText_5="\u30ab\u30e9\u30fc\u7206\u5f3e\u3092\u6483\u3064\u3068\u3001\n\u307e\u308f\u308a\u306e\u30d0\u30eb\u30fc\u30f3\u304c\u7206\u5f3e\u3068\u540c\u3058\u8272\u306b\u5909\u308f\u308a\u307e\u3059\u3002";
P["jp-jp"].TutorialTitle_7="\u304a\u52a9\u3051\u30a2\u30a4\u30c6\u30e0";P["jp-jp"].TutorialText_7="\u30d5\u30a1\u30a4\u30e4\u30fc\u30dc\u30fc\u30eb\u3092\u6483\u3064\u3068\u3001\n\u4e00\u5217\u3059\u3079\u3066\u306e\u30d0\u30d6\u30eb\u3092\u6d88\u3059\u3053\u3068\u304c\u3067\u304d\u307e\u3059\u3002";P["jp-jp"].TutorialTitle_0="\u3042\u305d\u3073\u65b9";P["jp-jp"].TutorialText_4="\u307e\u308f\u308a\u306e\u30d0\u30eb\u30fc\u30f3\u3092\u6d88\u3057\u3066\u3001\n\u77f3\u3092\u53d6\u308a\u9664\u3044\u3066\u304f\u3060\u3055\u3044\u3002";
P["jp-jp"].TutorialTitle_4="\u304a\u90aa\u9b54\u30a2\u30a4\u30c6\u30e0";window.throbber=new tb("throbber","media/throbber.png");window.PG_StartScreenLogo=new tb("PG_StartScreenLogo","../logos/PG_StartScreenLogo.png");window.lvl_test=" 0 0 0 0 0   D   0 0 0 0 0 ;0 1 5 3 4 4     4 3 5 5 5  ; 1 5 5 1 1 1 | 5 3 3 5 2   ;2 5 2 5 2 1  |2 5 2 5 2 1  ;   5 5 5 0 1 | 5 5 5 5 5   ;R   2 3 5 5  |4 4 5 5 4    ;   1 1 1 1 1 | 3 3 3 3 2   ;2 2 2 2 2 2  |2 1 2 2 2 1  ;                             ;B B B B B r     e B B B B B".split(";");
var xc=new ua("StartTexture",1,"start");window.StartTexture=xc;va(xc,0,"media/StartTexture0.png");var yc=new ua("StartScreenTexture",1,"load");window.StartScreenTexture=yc;va(yc,0,"media/StartScreenTexture0.png");var zc=new ua("LevelMapScreenTexture",1,"load");window.LevelMapScreenTexture=zc;va(zc,0,"media/LevelMapScreenTexture0.png");var Ac=new ua("LevelEndTexture",2,"load");window.LevelEndTexture=Ac;va(Ac,0,"media/LevelEndTexture0.png");va(Ac,1,"media/LevelEndTexture1.png");
var Q=new ua("MenuTexture",2,"load");window.MenuTexture=Q;va(Q,0,"media/MenuTexture0.png");va(Q,1,"media/MenuTexture1.png");var Bc=new ua("GameTexture",2,"load");window.GameTexture=Bc;va(Bc,0,"media/GameTexture0.png");va(Bc,1,"media/GameTexture1.png");var Cc=new ua("GameStaticTexture",2,"load");window.GameStaticTexture=Cc;va(Cc,0,"media/GameStaticTexture0.png");va(Cc,1,"media/GameStaticTexture1.png");var Dc=new ua("TutorialTexture",1,"load");window.TutorialTexture=Dc;va(Dc,0,"media/TutorialTexture0.png");
var Ec=new ua("FloaterTexture",1,"load");window.FloaterTexture=Ec;va(Ec,0,"media/FloaterTexture0.png");var Fc=new p("s_loadingbar_background",yc,1,42,32,0,0,42,32,1);window.s_loadingbar_background=Fc;Fc.c(0,0,673,161,42,32,0,0);var Gc=new p("s_level_0",zc,1,125,140,0,0,125,140,1);window.s_level_0=Gc;Gc.c(0,0,129,1,125,140,0,0);var Hc=new p("s_level_1",zc,1,125,140,0,0,125,140,1);window.s_level_1=Hc;Hc.c(0,0,257,1,125,140,0,0);var Ic=new p("s_level_2",zc,1,125,140,0,0,125,140,1);window.s_level_2=Ic;
Ic.c(0,0,1,1,125,140,0,0);var Jc=new p("s_level_3",zc,1,125,140,0,0,125,140,1);window.s_level_3=Jc;Jc.c(0,0,385,1,125,140,0,0);var Kc=new p("s_level_lock",zc,1,48,70,0,0,48,70,1);window.s_level_lock=Kc;Kc.c(0,0,777,113,48,69,0,1);var Lc=new p("s_level_stars",zc,1,126,46,0,0,126,46,1);window.s_level_stars=Lc;Lc.c(0,0,513,1,126,45,0,1);var Mc=new p("s_level2_0",zc,1,84,87,0,0,84,87,1);window.s_level2_0=Mc;Mc.c(0,0,897,97,84,87,0,0);var Nc=new p("s_level2_1",zc,1,84,87,0,0,84,87,1);
window.s_level2_1=Nc;Nc.c(0,0,897,1,84,87,0,0);var Oc=new p("s_level2_2",zc,1,84,87,0,0,84,87,1);window.s_level2_2=Oc;Oc.c(0,0,601,113,84,87,0,0);var Pc=new p("s_level2_3",zc,1,84,87,0,0,84,87,1);window.s_level2_3=Pc;Pc.c(0,0,513,49,84,87,0,0);var Qc=new p("s_level2_arrow_right",zc,2,60,108,0,0,60,216,1);window.s_level2_arrow_right=Qc;Qc.c(0,0,833,1,60,108,0,0);Qc.c(1,0,641,1,60,108,0,0);var Rc=new p("s_level2_arrow_left",zc,2,60,108,0,0,60,216,1);window.s_level2_arrow_left=Rc;
Rc.c(0,0,705,1,60,108,0,0);Rc.c(1,0,769,1,60,108,0,0);var Sc=new p("s_level2_lock",zc,1,84,87,0,0,84,87,1);window.s_level2_lock=Sc;Sc.c(0,0,689,113,84,87,0,0);var Tc=new p("s_pop_medal",Ac,8,378,378,189,189,3024,378,8);window.s_pop_medal=Tc;Tc.c(0,0,609,1,349,241,3,69);Tc.c(1,0,609,529,346,267,5,54);Tc.c(2,0,609,249,348,276,20,56);Tc.c(3,1,1,1,342,288,26,50);Tc.c(4,1,689,1,319,292,22,46);Tc.c(5,1,1,297,337,304,14,41);Tc.c(6,0,1,681,343,305,12,41);Tc.c(7,1,345,1,341,304,13,41);
var Uc=new p("s_medal_shadow",Ac,1,195,208,0,0,195,208,1);window.s_medal_shadow=Uc;Uc.c(0,1,745,513,189,204,3,1);var Vc=new p("s_medal_shine",Ac,6,195,208,0,0,1170,208,6);window.s_medal_shine=Vc;Vc.c(0,1,545,513,193,207,1,1);Vc.c(1,1,345,313,193,207,1,1);Vc.c(2,0,353,681,193,207,1,1);Vc.c(3,1,689,297,193,207,1,1);Vc.c(4,0,553,801,193,207,1,1);Vc.c(5,0,753,801,193,207,1,1);var Wc=new p("s_icon_toggle_hard",Q,1,67,67,0,0,67,67,1);window.s_icon_toggle_hard=Wc;Wc.c(0,0,945,441,67,67,0,0);
var Xc=new p("s_icon_toggle_medium",Q,1,67,67,0,0,67,67,1);window.s_icon_toggle_medium=Xc;Xc.c(0,0,945,513,67,67,0,0);var Yc=new p("s_icon_toggle_easy",Q,1,67,67,0,0,67,67,1);window.s_icon_toggle_easy=Yc;Yc.c(0,0,945,585,67,67,0,0);var Zc=new p("s_flagIcon_us",Q,1,48,48,0,0,48,48,1);window.s_flagIcon_us=Zc;Zc.c(0,0,713,809,48,36,0,6);var $c=new p("s_flagIcon_gb",Q,1,48,48,0,0,48,48,1);window.s_flagIcon_gb=$c;$c.c(0,0,601,809,48,36,0,6);var ad=new p("s_flagIcon_nl",Q,1,48,48,0,0,48,48,1);
window.s_flagIcon_nl=ad;ad.c(0,0,657,809,48,36,0,6);var bd=new p("s_flagIcon_tr",Q,1,48,48,0,0,48,48,1);window.s_flagIcon_tr=bd;bd.c(0,0,545,809,48,36,0,6);var cd=new p("s_flagIcon_de",Q,1,48,48,0,0,48,48,1);window.s_flagIcon_de=cd;cd.c(0,0,769,809,48,36,0,6);var dd=new p("s_flagIcon_fr",Q,1,48,48,0,0,48,48,1);window.s_flagIcon_fr=dd;dd.c(0,0,825,809,48,36,0,6);var ed=new p("s_flagIcon_br",Q,1,48,48,0,0,48,48,1);window.s_flagIcon_br=ed;ed.c(0,0,601,849,48,36,0,6);
var fd=new p("s_flagIcon_es",Q,1,48,48,0,0,48,48,1);window.s_flagIcon_es=fd;fd.c(0,0,769,849,48,36,0,6);var gd=new p("s_flagIcon_jp",Q,1,48,48,0,0,48,48,1);window.s_flagIcon_jp=gd;gd.c(0,0,713,849,48,36,0,6);var hd=new p("s_flagIcon_ru",Q,1,48,48,0,0,48,48,1);window.s_flagIcon_ru=hd;hd.c(0,0,657,849,48,36,0,6);var id=new p("s_flagIcon_ar",Q,1,48,48,0,0,48,48,1);window.s_flagIcon_ar=id;id.c(0,0,545,849,48,36,0,6);var jd=new p("s_flagIcon_kr",Q,1,48,48,0,0,48,48,1);window.s_flagIcon_kr=jd;
jd.c(0,0,937,841,48,36,0,6);var kd=new p("s_flagIcon_it",Q,1,48,48,0,0,48,48,1);window.s_flagIcon_it=kd;kd.c(0,0,881,841,48,36,0,6);var ld=new p("s_tutorialButton_close",Q,1,66,65,0,0,66,65,1);window.s_tutorialButton_close=ld;ld.c(0,0,929,729,65,65,0,0);var md=new p("s_tutorialButton_next",Q,1,66,65,0,0,66,65,1);window.s_tutorialButton_next=md;md.c(0,0,841,633,66,65,0,0);var nd=new p("s_tutorialButton_previous",Q,1,66,65,0,0,66,65,1);window.s_tutorialButton_previous=nd;nd.c(0,0,929,657,66,65,0,0);
var od=new p("s_logo_charmstudio",Q,1,240,240,0,0,240,240,1);window.s_logo_charmstudio=od;od.c(0,0,609,177,240,240,0,0);var pd=new p("s_logo_charmteam",Q,1,240,240,0,0,240,240,1);window.s_logo_charmteam=pd;pd.c(0,0,609,1,240,167,0,36);var qd=new p("s_logo_charmstudio_start",yc,1,156,54,0,0,156,54,1);window.s_logo_charmstudio_start=qd;qd.c(0,0,521,1,156,53,0,0);var rd=new p("s_logo_charmteam_start",yc,1,300,104,0,0,300,104,1);window.s_logo_charmteam_start=rd;rd.c(0,0,521,57,150,104,75,0);
var sd=new p("s_ui_cup_highscore",Bc,1,32,28,0,0,32,28,1);window.s_ui_cup_highscore=sd;sd.c(0,0,649,89,32,28,0,0);var td=new p("s_ui_cup_score",Bc,1,28,24,0,0,28,24,1);window.s_ui_cup_score=td;td.c(0,0,753,89,28,24,0,0);var ud=new p("s_ui_endless_progress",Bc,1,408,12,0,0,408,12,1);window.s_ui_endless_progress=ud;ud.c(0,0,553,121,408,10,0,1);var vd=new p("s_ui_endless_background",Bc,1,640,118,0,0,640,118,1);window.s_ui_endless_background=vd;vd.c(0,0,1,1,640,118,0,0);
var wd=new p("s_ui_endless_progress_bonus",Bc,1,408,12,0,0,408,12,1);window.s_ui_endless_progress_bonus=wd;wd.c(0,0,1,129,408,10,0,1);var xd=new p("s_ui_heart",Bc,1,28,24,0,0,28,24,1);window.s_ui_heart=xd;xd.c(0,0,985,201,26,23,1,1);var yd=new p("s_ui_crown",Bc,1,24,20,0,0,24,20,1);window.s_ui_crown=yd;yd.c(0,0,785,97,24,20,0,0);var zd=new p("s_ui_background_blank",Cc,1,640,118,0,0,640,118,1);window.s_ui_background_blank=zd;zd.c(0,1,1,1,640,117,0,0);
var Ad=new p("s_ui_highscore",Cc,1,26,36,13,12,26,36,1);window.s_ui_highscore=Ad;Ad.c(0,0,889,1,26,36,0,0);var Bd=new p("s_arrow_switch",Cc,1,234,42,6,11,234,42,1);window.s_arrow_switch=Bd;Bd.c(0,0,649,1,234,42,0,0);var Cd=new p("s_booster_bomb",Bc,1,50,50,25,25,50,50,1);window.s_booster_bomb=Cd;Cd.c(0,0,929,465,50,50,0,0);var Dd=new p("s_booster_fire",Bc,6,50,50,25,25,300,50,6);window.s_booster_fire=Dd;Dd.c(0,0,705,385,50,50,0,0);Dd.c(1,0,913,409,50,50,0,0);Dd.c(2,0,969,409,50,50,0,0);
Dd.c(3,0,913,57,50,50,0,0);Dd.c(4,0,705,441,50,50,0,0);Dd.c(5,0,817,449,50,50,0,0);var Ed=new p("s_booster_fire_trail",Bc,11,48,48,24,24,528,48,11);window.s_booster_fire_trail=Ed;Ed.c(0,0,353,337,48,46,0,1);Ed.c(1,0,705,553,48,48,0,0);Ed.c(2,0,873,577,46,46,0,1);Ed.c(3,0,921,577,44,44,2,2);Ed.c(4,0,761,585,42,42,3,3);Ed.c(5,0,985,1,38,38,5,5);Ed.c(6,0,985,41,36,36,6,6);Ed.c(7,0,985,81,35,35,7,7);Ed.c(8,0,985,121,34,34,7,7);Ed.c(9,0,985,161,33,33,8,8);Ed.c(10,0,721,89,30,30,9,9);
var Fd=new p("s_booster_white",Bc,1,50,50,25,25,50,50,1);window.s_booster_white=Fd;Fd.c(0,0,705,497,50,50,0,0);var Gd=new p("s_bubble_blocker",Bc,1,50,50,25,25,50,50,1);window.s_bubble_blocker=Gd;Gd.c(0,0,761,417,50,50,0,0);var Hd=new p("s_cannon",Bc,1,66,132,33,99,66,132,1);window.s_cannon=Hd;Hd.c(0,0,769,137,66,132,0,0);var Id=new p("s_cannon_counter",Bc,1,154,80,120,34,154,80,1);window.s_cannon_counter=Id;Id.c(0,0,649,1,154,80,0,0);var Jd=new p("s_effect_star",Bc,1,47,46,23,24,47,46,1);
window.s_effect_star=Jd;Jd.c(0,0,817,561,47,46,0,0);var Kd=new p("s_explosion",Bc,7,64,64,32,32,448,64,7);window.s_explosion=Kd;Kd.c(0,0,353,273,55,56,3,3);Kd.c(1,0,913,265,64,63,0,1);Kd.c(2,0,769,273,64,64,0,0);Kd.c(3,0,841,305,64,64,0,0);Kd.c(4,0,913,337,64,64,0,0);Kd.c(5,0,769,345,64,64,0,0);Kd.c(6,0,841,377,63,64,1,0);var Ld=new p("s_guideline",Bc,1,7,260,0,0,7,260,1);window.s_guideline=Ld;Ld.c(0,0,969,1,7,259,0,1);var Md=new p("s_guideline_pointer",Bc,1,21,21,10,10,21,21,1);
window.s_guideline_pointer=Md;Md.c(0,0,817,97,21,21,0,0);var Nd=new p("s_mistake",Bc,1,70,70,35,35,70,70,1);window.s_mistake=Nd;Nd.c(0,0,841,233,70,70,0,0);var Od=new p("s_pop",Bc,5,64,64,32,32,320,64,5);window.s_pop=Od;Od.c(0,0,689,89,30,24,19,19);Od.c(1,0,969,577,42,35,13,14);Od.c(2,0,913,1,50,53,6,5);Od.c(3,0,353,209,62,60,1,2);Od.c(4,0,353,145,62,62,0,1);var Pd=new p("s_tutorial_01",Dc,1,350,190,0,0,350,190,1);window.s_tutorial_01=Pd;Pd.c(0,0,345,1,250,173,48,17);
var Qd=new p("s_tutorial_02",Dc,1,350,190,0,0,350,190,1);window.s_tutorial_02=Qd;Qd.c(0,0,1,129,250,173,48,17);var Rd=new p("s_tutorial_03",Dc,1,350,190,0,0,350,190,1);window.s_tutorial_03=Rd;Rd.c(0,0,601,1,250,173,48,17);var Sd=new p("s_tutorial_04",Dc,1,350,190,0,0,350,190,1);window.s_tutorial_04=Sd;Sd.c(0,0,1,1,340,126,0,37);var Td=new p("s_tutorial_05",Dc,1,350,190,0,0,350,190,1);window.s_tutorial_05=Td;Td.c(0,0,857,113,93,93,129,49);var Ud=new p("s_tutorial_06",Dc,1,350,190,0,0,350,190,1);
window.s_tutorial_06=Ud;Ud.c(0,0,857,1,119,109,117,42);var Wd=new p("s_tutorial_07",Dc,1,350,190,0,0,350,190,1);window.s_tutorial_07=Wd;Wd.c(0,0,257,177,92,92,129,49);var Xd=new p("s_tutorial_08",Dc,1,350,190,0,0,350,190,1);window.s_tutorial_08=Xd;Xd.c(0,0,353,177,78,78,138,58);var Yd=new p("s_pop_floater",Bc,8,378,378,174,193,3024,378,8);window.s_pop_floater=Yd;Yd.c(0,0,417,137,349,241,3,69);Yd.c(1,0,353,385,346,267,5,54);Yd.c(2,0,1,145,348,276,20,56);Yd.c(3,0,353,657,342,288,26,50);
Yd.c(4,0,697,657,319,292,22,46);Yd.c(5,1,345,1,337,304,14,41);Yd.c(6,0,1,425,343,305,12,41);Yd.c(7,1,1,1,341,304,13,41);var Zd=new p("s_icon_toggle_sfx_on",Q,1,67,67,0,0,67,67,1);window.s_icon_toggle_sfx_on=Zd;Zd.c(0,0,929,801,49,31,7,17);var $d=new p("s_icon_toggle_sfx_off",Q,1,67,67,0,0,67,67,1);window.s_icon_toggle_sfx_off=$d;$d.c(0,0,961,345,53,31,7,17);var be=new p("s_icon_toggle_music_on",Q,1,67,67,0,0,67,67,1);window.s_icon_toggle_music_on=be;be.c(0,0,985,193,38,41,13,16);
var ce=new p("s_icon_toggle_music_off",Q,1,67,67,0,0,67,67,1);window.s_icon_toggle_music_off=ce;ce.c(0,0,961,385,51,41,8,16);var de=new p("s_btn_small_exit",Q,2,100,92,0,0,200,92,2);window.s_btn_small_exit=de;de.c(0,0,233,777,100,92,0,0);de.c(1,0,857,345,100,92,0,0);var ee=new p("s_btn_small_pause",Bc,2,100,92,0,0,200,92,2);window.s_btn_small_pause=ee;ee.c(0,0,809,1,100,92,0,0);ee.c(1,0,841,137,100,92,0,0);var fe=new p("s_btn_small_options",Q,2,100,92,0,0,200,92,2);window.s_btn_small_options=fe;
fe.c(0,0,841,441,100,92,0,0);fe.c(1,0,841,537,100,92,0,0);var ge=new p("s_btn_small_retry",Ac,2,100,92,0,0,200,92,2);window.s_btn_small_retry=ge;ge.c(0,0,353,897,100,92,0,0);ge.c(1,1,889,297,100,92,0,0);var he=new p("s_btn_standard",Q,2,96,92,0,0,192,92,2);window.s_btn_standard=he;he.c(0,0,337,777,96,92,0,0);he.c(1,0,441,809,96,92,0,0);var ie=new p("s_btn_toggle",Q,2,162,92,0,0,324,92,2);window.s_btn_toggle=ie;ie.c(0,0,857,97,162,92,0,0);ie.c(1,0,857,1,162,92,0,0);
var je=new p("s_icon_toggle_fxoff",Q,2,227,92,0,0,454,92,2);window.s_icon_toggle_fxoff=je;je.c(0,0,609,425,227,92,0,0);je.c(1,0,233,681,227,92,0,0);var ke=new p("s_icon_toggle_fxon",Q,2,227,92,0,0,454,92,2);window.s_icon_toggle_fxon=ke;ke.c(0,0,609,521,227,92,0,0);ke.c(1,0,609,617,227,92,0,0);var le=new p("s_icon_toggle_musicoff",Q,2,227,92,0,0,454,92,2);window.s_icon_toggle_musicoff=le;le.c(0,0,1,681,227,92,0,0);le.c(1,0,465,713,227,92,0,0);
var me=new p("s_icon_toggle_musicon",Q,2,227,92,0,0,454,92,2);window.s_icon_toggle_musicon=me;me.c(0,0,697,713,227,92,0,0);me.c(1,0,1,777,227,92,0,0);var ne=new p("s_btn_big_start",Ac,2,154,152,0,0,308,152,2);window.s_btn_big_start=ne;ne.c(0,1,321,689,154,152,0,0);ne.c(1,1,161,609,154,152,0,0);var oe=new p("s_btn_bigtext",yc,2,153,152,0,0,306,152,2);window.s_btn_bigtext=oe;oe.c(0,0,681,1,153,152,0,0);oe.c(1,0,841,1,153,152,0,0);var pe=new p("s_btn_big_restart",Ac,2,154,152,0,0,308,152,2);
window.s_btn_big_restart=pe;pe.c(0,1,345,529,154,152,0,0);pe.c(1,1,1,609,154,152,0,0);var qe=new p("s_overlay_assignment",Cc,1,598,526,0,0,598,526,1);window.s_overlay_assignment=qe;qe.c(0,1,1,121,598,526,0,0);var re=new p("s_overlay_options",Q,1,600,676,0,0,600,676,1);window.s_overlay_options=re;re.c(0,0,1,1,600,676,0,0);var se=new p("s_screen_start",xc,1,640,960,0,0,640,960,1);window.s_screen_start=se;se.c(0,0,1,1,640,960,0,0);var te=new p("s_tutorial",Q,1,524,562,0,0,524,562,1);
window.s_tutorial=te;te.c(0,1,1,1,524,562,0,0);var ue=new p("s_overlay_endless",Ac,1,600,676,0,0,600,676,1);window.s_overlay_endless=ue;ue.c(0,0,1,1,600,676,0,0);var ve=new p("s_bubbles",Bc,6,50,50,25,25,300,50,6);window.s_bubbles=ve;ve.c(0,0,761,473,50,50,0,0);ve.c(1,0,761,529,50,50,0,0);ve.c(2,0,929,521,50,50,0,0);ve.c(3,0,817,505,50,50,0,0);ve.c(4,0,873,521,50,50,0,0);ve.c(5,0,873,465,50,50,0,0);var we=new p("s_border",Bc,1,550,2,0,0,550,2,1);window.s_border=we;we.c(0,0,1,121,550,2,0,0);
var xe=new p("s_background",Cc,1,640,960,0,0,640,960,1);window.s_background=xe;xe.c(0,0,1,1,640,960,0,0);var ye=new p("s_logo",yc,1,516,254,0,0,516,254,1);window.s_logo=ye;ye.c(0,0,1,1,516,254,0,0);var ze=new p("s_logo_preload_charmstudio",xc,1,322,54,0,0,322,54,1);window.s_logo_preload_charmstudio=ze;ze.c(0,0,649,1,320,54,0,0);var Ae=new p("s_loadingbar_bg",xc,1,38,20,0,0,38,20,1);window.s_loadingbar_bg=Ae;Ae.c(0,0,977,1,38,20,0,0);var Be=new p("s_loadingbar_fill",xc,1,30,12,0,0,30,12,1);
window.s_loadingbar_fill=Be;Be.c(0,0,977,25,30,12,0,0);var Ce=new p("s_logo_about",Q,1,121,121,0,0,121,121,1);window.s_logo_about=Ce;Ce.c(0,0,857,257,117,80,2,21);var De=new p("s_logo_poki_about",Q,1,123,58,0,0,123,58,1);window.s_logo_poki_about=De;De.c(0,0,857,193,123,58,0,0);var Ee=new p("s_logo_poki_start",xc,1,120,60,0,0,120,60,1);window.s_logo_poki_start=Ee;Ee.c(0,0,857,57,119,59,1,1);var Fe=new p("s_ads_background",xc,1,200,200,100,100,200,200,1);window.s_ads_background=Fe;
Fe.c(0,0,649,57,200,200,0,0);var Ge=new xa("scoreFloater_neg");window.scoreFloater_neg=Ge;Ge.b=new p("scoreFloater_negImage",Ec,13,34,59,0,0);Ge.b.c(0,0,625,65,1,1,0,0,1,1,1);Ge.b.c(1,0,865,353,26,25,4,14,1,1,1);Ge.b.c(2,0,953,353,21,11,7,23,1,1,1);Ge.b.c(3,0,169,353,23,30,6,12,1,1,1);Ge.b.c(4,0,1001,281,22,30,7,12,1,1,1);Ge.b.c(5,0,889,321,24,30,6,12,1,1,1);Ge.b.c(6,0,857,321,23,30,6,12,1,1,1);Ge.b.c(7,0,825,321,25,30,5,12,1,1,1);Ge.b.c(8,0,921,321,23,30,6,12,1,1,1);
Ge.b.c(9,0,953,321,24,30,6,12,1,1,1);Ge.b.c(10,0,985,321,23,30,5,12,1,1,1);Ge.b.c(11,0,137,329,23,30,6,12,1,1,1);Ge.b.c(12,0,569,321,24,30,5,12,1,1,1);
Ge.index=[-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,-1,2,-1,-1,3,4,5,6,7,8,9,10,11,12,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1];
Ge.left=[12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,8,12,9,12,12,8,8,8,8,8,8,8,8,8,8,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,
12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12];
Ge.width=[10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,18,10,16,10,10,18,18,18,18,18,18,18,18,18,18,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,
10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10];Ge.top=8;Ge.height=43;Ge.eh=38;var He=new xa("scoreFloater_pos");window.scoreFloater_pos=He;He.b=new p("scoreFloater_posImage",Ec,13,34,59,0,0);He.b.c(0,0,65,65,1,1,0,0,1,1,1);He.b.c(1,0,897,353,26,25,4,14,1,1,1);
He.b.c(2,0,929,353,21,11,7,23,1,1,1);He.b.c(3,0,25,329,23,30,6,12,1,1,1);He.b.c(4,0,1,329,22,30,7,12,1,1,1);He.b.c(5,0,793,321,24,30,6,12,1,1,1);He.b.c(6,0,601,321,23,30,6,12,1,1,1);He.b.c(7,0,697,321,25,30,5,12,1,1,1);He.b.c(8,0,633,321,23,30,6,12,1,1,1);He.b.c(9,0,761,321,24,30,6,12,1,1,1);He.b.c(10,0,729,321,23,30,5,12,1,1,1);He.b.c(11,0,665,321,23,30,6,12,1,1,1);He.b.c(12,0,105,329,24,30,5,12,1,1,1);
He.index=[-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,-1,2,-1,-1,3,4,5,6,7,8,9,10,11,12,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1];
He.left=[12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,8,12,9,12,12,8,8,8,8,8,8,8,8,8,8,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,
12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12];
He.width=[10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,18,10,16,10,10,18,18,18,18,18,18,18,18,18,18,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,
10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10];He.top=8;He.height=43;He.eh=38;var R=new xa("VerdanaFloater1");window.VerdanaFloater1=R;R.b=new p("VerdanaFloater1Image",Ec,59,44,46,0,0);R.b.c(0,0,617,57,1,1,0,0,1,1,1);R.b.c(1,0,681,353,17,30,12,11,1,1,1);
R.b.c(2,0,529,321,31,30,4,11,1,1,1);R.b.c(3,0,649,353,28,30,6,11,1,1,1);R.b.c(4,0,801,353,28,30,6,11,1,1,1);R.b.c(5,0,737,353,30,30,5,11,1,1,1);R.b.c(6,0,265,353,25,30,7,11,1,1,1);R.b.c(7,0,361,353,25,30,8,11,1,1,1);R.b.c(8,0,705,353,29,30,5,11,1,1,1);R.b.c(9,0,201,353,29,30,5,11,1,1,1);R.b.c(10,0,553,353,23,30,9,11,1,1,1);R.b.c(11,0,833,353,23,30,8,11,1,1,1);R.b.c(12,0,393,353,29,30,6,11,1,1,1);R.b.c(13,0,457,353,26,30,8,11,1,1,1);R.b.c(14,0,249,321,32,30,4,11,1,1,1);
R.b.c(15,0,521,353,29,30,5,11,1,1,1);R.b.c(16,0,489,321,31,30,4,11,1,1,1);R.b.c(17,0,425,353,27,30,7,11,1,1,1);R.b.c(18,0,177,281,31,35,4,11,1,1,1);R.b.c(19,0,297,353,30,30,6,11,1,1,1);R.b.c(20,0,233,353,28,30,6,11,1,1,1);R.b.c(21,0,489,353,29,30,5,11,1,1,1);R.b.c(22,0,585,353,28,30,6,11,1,1,1);R.b.c(23,0,289,321,31,30,4,11,1,1,1);R.b.c(24,0,217,201,38,30,1,11,1,1,1);R.b.c(25,0,361,321,31,30,4,11,1,1,1);R.b.c(26,0,401,321,31,30,5,11,1,1,1);R.b.c(27,0,769,353,28,30,6,11,1,1,1);
R.b.c(28,0,1,209,31,37,4,4,1,1,1);R.b.c(29,0,897,201,31,37,4,4,1,1,1);R.b.c(30,0,625,241,31,36,4,5,1,1,1);R.b.c(31,0,665,241,31,36,4,5,1,1,1);R.b.c(32,0,249,281,31,35,4,6,1,1,1);R.b.c(33,0,321,281,31,35,4,6,1,1,1);R.b.c(34,0,457,201,37,30,0,11,1,1,1);R.b.c(35,0,113,249,28,35,6,11,1,1,1);R.b.c(36,0,425,201,25,37,7,4,1,1,1);R.b.c(37,0,529,201,25,37,7,4,1,1,1);R.b.c(38,0,497,201,25,37,7,4,1,1,1);R.b.c(39,0,145,249,25,35,7,6,1,1,1);R.b.c(40,0,393,201,23,37,9,4,1,1,1);
R.b.c(41,0,297,201,23,37,9,4,1,1,1);R.b.c(42,0,601,201,23,37,9,4,1,1,1);R.b.c(43,0,457,273,23,35,9,6,1,1,1);R.b.c(44,0,169,321,32,30,3,11,1,1,1);R.b.c(45,0,705,241,29,36,5,5,1,1,1);R.b.c(46,0,561,201,31,37,4,4,1,1,1);R.b.c(47,0,817,201,31,37,4,4,1,1,1);R.b.c(48,0,857,201,31,37,4,4,1,1,1);R.b.c(49,0,801,241,31,36,4,5,1,1,1);R.b.c(50,0,65,281,31,35,4,6,1,1,1);R.b.c(51,0,65,321,31,33,4,10,1,1,1);R.b.c(52,0,785,201,28,37,6,4,1,1,1);R.b.c(53,0,753,201,28,37,6,4,1,1,1);
R.b.c(54,0,721,201,28,37,6,4,1,1,1);R.b.c(55,0,217,273,28,35,6,6,1,1,1);R.b.c(56,0,681,201,31,37,5,4,1,1,1);R.b.c(57,0,617,353,27,30,7,11,1,1,1);R.b.c(58,0,329,321,27,31,7,10,1,1,1);
R.index=[-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,-1,51,52,53,54,55,56,57,58,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1];
R.left=[18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,17,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,12,12,13,11,13,14,12,11,15,15,12,14,10,11,11,13,11,12,13,13,12,12,8,12,13,13,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,
18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,12,12,12,12,12,12,8,13,13,13,13,13,15,15,15,15,11,11,11,11,11,11,11,18,11,12,12,12,12,13,13,13,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18];
R.width=[8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,10,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,19,19,18,21,17,16,20,21,13,14,19,16,24,21,21,18,21,19,17,17,20,19,28,19,18,17,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,19,19,19,19,19,19,27,18,17,17,17,17,13,13,13,13,21,21,21,21,21,21,21,8,21,20,20,20,
20,18,18,18,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8];R.top=8;R.height=30;R.eh=33;var S=new xa("VerdanaFloater2");window.VerdanaFloater2=S;S.b=new p("VerdanaFloater2Image",Ec,59,45,48,0,0);S.b.c(0,0,617,65,1,1,0,0,1,1,1);S.b.c(1,0,1009,41,13,34,16,10,1,1,1);S.b.c(2,0,489,281,30,34,8,10,1,1,1);S.b.c(3,0,737,281,25,34,11,10,1,1,1);S.b.c(4,0,681,281,26,34,9,10,1,1,1);S.b.c(5,0,769,281,27,34,10,10,1,1,1);S.b.c(6,0,833,281,22,34,12,10,1,1,1);S.b.c(7,0,881,281,22,34,12,10,1,1,1);
S.b.c(8,0,937,281,28,34,8,10,1,1,1);S.b.c(9,0,905,281,25,34,10,10,1,1,1);S.b.c(10,0,857,281,19,34,13,10,1,1,1);S.b.c(11,0,713,281,21,34,12,10,1,1,1);S.b.c(12,0,425,281,27,34,11,10,1,1,1);S.b.c(13,0,1001,241,22,34,13,10,1,1,1);S.b.c(14,0,361,281,29,34,8,10,1,1,1);S.b.c(15,0,393,281,26,34,10,10,1,1,1);S.b.c(16,0,553,281,30,34,8,10,1,1,1);S.b.c(17,0,649,281,25,34,11,10,1,1,1);S.b.c(18,0,81,201,30,38,8,10,1,1,1);S.b.c(19,0,585,281,27,34,11,10,1,1,1);S.b.c(20,0,521,281,26,34,10,10,1,1,1);
S.b.c(21,0,617,281,25,34,10,10,1,1,1);S.b.c(22,0,801,281,27,34,9,10,1,1,1);S.b.c(23,0,217,313,29,34,8,10,1,1,1);S.b.c(24,0,257,201,38,34,4,10,1,1,1);S.b.c(25,0,1,289,29,34,8,10,1,1,1);S.b.c(26,0,969,281,29,34,8,10,1,1,1);S.b.c(27,0,105,289,25,34,10,10,1,1,1);S.b.c(28,0,769,105,30,41,8,3,1,1,1);S.b.c(29,0,457,105,30,41,8,3,1,1,1);S.b.c(30,0,481,57,30,44,8,0,1,1,1);S.b.c(31,0,225,153,30,40,8,4,1,1,1);S.b.c(32,0,193,153,30,40,8,4,1,1,1);S.b.c(33,0,161,153,30,40,8,4,1,1,1);
S.b.c(34,0,937,201,37,34,3,10,1,1,1);S.b.c(35,0,185,201,26,38,9,10,1,1,1);S.b.c(36,0,433,105,22,41,12,3,1,1,1);S.b.c(37,0,409,105,22,41,12,3,1,1,1);S.b.c(38,0,665,97,22,41,12,3,1,1,1);S.b.c(39,0,913,105,22,40,12,4,1,1,1);S.b.c(40,0,385,105,19,41,13,3,1,1,1);S.b.c(41,0,489,105,19,41,13,3,1,1,1);S.b.c(42,0,513,105,20,41,13,3,1,1,1);S.b.c(43,0,1001,105,19,40,13,4,1,1,1);S.b.c(44,0,33,289,29,34,8,10,1,1,1);S.b.c(45,0,937,105,26,40,10,4,1,1,1);S.b.c(46,0,569,105,30,41,8,3,1,1,1);
S.b.c(47,0,297,57,30,44,8,0,1,1,1);S.b.c(48,0,801,105,30,41,8,3,1,1,1);S.b.c(49,0,129,113,30,40,8,4,1,1,1);S.b.c(50,0,337,145,30,40,8,4,1,1,1);S.b.c(51,0,361,201,30,37,8,9,1,1,1);S.b.c(52,0,737,105,27,41,9,3,1,1,1);S.b.c(53,0,601,105,27,41,9,3,1,1,1);S.b.c(54,0,537,105,27,41,9,3,1,1,1);S.b.c(55,0,81,153,27,40,9,4,1,1,1);S.b.c(56,0,633,105,29,41,8,3,1,1,1);S.b.c(57,0,137,289,25,34,11,10,1,1,1);S.b.c(58,0,289,281,25,35,11,9,1,1,1);
S.index=[-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,-1,51,52,53,54,55,56,57,58,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1];
S.left=[18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,17,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,12,12,12,11,13,13,11,11,15,15,12,14,9,11,11,12,11,12,13,13,11,12,7,12,12,13,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,
18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,12,12,12,12,12,12,7,12,13,13,13,13,15,15,15,15,11,11,11,11,11,11,11,18,11,11,11,11,11,12,12,13,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18,18];
S.width=[9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,11,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,21,21,20,23,19,18,22,23,15,15,21,17,26,23,23,20,23,21,19,19,22,21,31,21,20,19,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,21,21,21,21,21,21,30,20,19,19,19,19,15,15,15,15,23,23,23,23,23,23,23,9,23,22,22,22,
22,20,20,19,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9];S.top=7;S.height=34;S.eh=35;var U=new xa("VerdanaFloater3");window.VerdanaFloater3=U;U.b=new p("VerdanaFloater3Image",Ec,60,48,51,0,0);U.b.c(0,0,625,57,1,1,0,0,1,1,1);U.b.c(1,0,1009,1,14,36,17,12,1,1,1);U.b.c(2,0,761,241,32,36,8,12,1,1,1);U.b.c(3,0,873,241,27,36,11,12,1,1,1);U.b.c(4,0,841,241,26,36,11,12,1,1,1);U.b.c(5,0,905,241,29,36,10,12,1,1,1);U.b.c(6,0,1,249,24,36,12,12,1,1,1);U.b.c(7,0,969,241,24,36,13,12,1,1,1);
U.b.c(8,0,937,241,29,36,9,12,1,1,1);U.b.c(9,0,33,249,28,36,10,12,1,1,1);U.b.c(10,0,737,241,22,36,14,12,1,1,1);U.b.c(11,0,641,153,21,36,12,12,1,1,1);U.b.c(12,0,249,241,29,36,11,12,1,1,1);U.b.c(13,0,281,241,24,36,13,12,1,1,1);U.b.c(14,0,73,241,31,36,8,12,1,1,1);U.b.c(15,0,113,209,28,36,10,12,1,1,1);U.b.c(16,0,457,233,30,36,9,12,1,1,1);U.b.c(17,0,217,233,27,36,12,12,1,1,1);U.b.c(18,0,297,153,30,39,9,12,1,1,1);U.b.c(19,0,41,209,29,36,11,12,1,1,1);U.b.c(20,0,185,241,27,36,11,12,1,1,1);
U.b.c(21,0,385,241,28,36,10,12,1,1,1);U.b.c(22,0,553,241,27,36,10,12,1,1,1);U.b.c(23,0,585,241,32,36,8,12,1,1,1);U.b.c(24,0,337,105,41,36,4,12,1,1,1);U.b.c(25,0,313,241,32,36,8,12,1,1,1);U.b.c(26,0,489,241,30,36,10,12,1,1,1);U.b.c(27,0,521,241,27,36,10,12,1,1,1);U.b.c(28,0,513,57,32,44,8,4,1,1,1);U.b.c(29,0,409,57,32,44,8,4,1,1,1);U.b.c(30,0,809,1,32,48,8,0,1,1,1);U.b.c(31,0,1,65,32,43,8,5,1,1,1);U.b.c(32,0,257,105,32,42,8,6,1,1,1);U.b.c(33,0,297,105,32,42,8,6,1,1,1);
U.b.c(34,0,81,113,40,36,3,12,1,1,1);U.b.c(35,0,489,153,26,39,11,12,1,1,1);U.b.c(36,0,553,57,24,44,12,4,1,1,1);U.b.c(37,0,449,57,24,44,12,4,1,1,1);U.b.c(38,0,353,57,24,44,12,4,1,1,1);U.b.c(39,0,161,105,24,42,12,6,1,1,1);U.b.c(40,0,665,49,22,44,14,4,1,1,1);U.b.c(41,0,329,57,22,44,14,4,1,1,1);U.b.c(42,0,385,57,22,44,14,4,1,1,1);U.b.c(43,0,41,65,22,42,14,6,1,1,1);U.b.c(44,0,417,241,31,36,8,12,1,1,1);U.b.c(45,0,945,57,28,43,10,5,1,1,1);U.b.c(46,0,585,57,30,44,9,4,1,1,1);
U.b.c(47,0,633,49,30,48,9,0,1,1,1);U.b.c(48,0,833,57,30,44,9,4,1,1,1);U.b.c(49,0,977,57,30,43,9,5,1,1,1);U.b.c(50,0,225,105,30,42,9,6,1,1,1);U.b.c(51,0,457,313,27,32,11,15,1,1,1);U.b.c(52,0,969,105,30,40,9,10,1,1,1);U.b.c(53,0,737,57,27,44,10,4,1,1,1);U.b.c(54,0,865,57,27,44,10,4,1,1,1);U.b.c(55,0,769,57,27,44,10,4,1,1,1);U.b.c(56,0,193,105,27,42,10,6,1,1,1);U.b.c(57,0,801,57,30,44,10,4,1,1,1);U.b.c(58,0,353,241,27,36,12,12,1,1,1);U.b.c(59,0,977,201,26,37,12,11,1,1,1);
U.index=[-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1];
U.left=[19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,18,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,12,12,13,11,13,14,11,11,16,15,12,14,9,11,11,13,11,12,13,13,11,12,7,12,13,13,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,
19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,12,12,12,12,12,12,7,13,13,13,13,13,16,16,16,16,11,11,11,11,11,11,11,11,11,11,11,11,11,13,13,13,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19,19];
U.width=[10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,12,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,24,23,22,25,21,20,25,25,16,17,23,19,29,26,26,22,26,24,22,21,25,23,34,23,22,21,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,
10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,24,24,24,24,24,24,33,22,21,21,21,21,16,16,16,16,25,26,26,26,26,26,26,26,26,25,25,25,25,22,22,22,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10];U.top=7;U.height=37;U.eh=38;var V=new xa("VerdanaFloater4");window.VerdanaFloater4=V;V.b=new p("VerdanaFloater4Image",Ec,59,58,61,0,0);V.b.c(0,0,73,65,1,1,0,0,1,1,1);V.b.c(1,0,665,145,21,39,19,16,1,1,1);
V.b.c(2,0,561,153,36,39,9,16,1,1,1);V.b.c(3,0,521,153,33,39,12,16,1,1,1);V.b.c(4,0,873,105,34,40,14,15,1,1,1);V.b.c(5,0,369,153,36,39,11,16,1,1,1);V.b.c(6,0,449,153,33,39,14,16,1,1,1);V.b.c(7,0,409,153,32,39,14,16,1,1,1);V.b.c(8,0,257,153,35,40,12,15,1,1,1);V.b.c(9,0,601,153,38,39,11,16,1,1,1);V.b.c(10,0,329,193,30,39,14,16,1,1,1);V.b.c(11,0,41,161,31,39,13,16,1,1,1);V.b.c(12,0,145,201,38,39,12,16,1,1,1);V.b.c(13,0,113,161,28,39,15,16,1,1,1);V.b.c(14,0,897,57,43,39,9,16,1,1,1);
V.b.c(15,0,641,193,38,39,11,16,1,1,1);V.b.c(16,0,1,113,36,40,12,15,1,1,1);V.b.c(17,0,969,153,34,39,13,16,1,1,1);V.b.c(18,0,257,57,36,46,12,15,1,1,1);V.b.c(19,0,889,153,34,39,12,16,1,1,1);V.b.c(20,0,41,113,35,40,12,15,1,1,1);V.b.c(21,0,769,153,33,39,16,16,1,1,1);V.b.c(22,0,729,153,35,39,13,16,1,1,1);V.b.c(23,0,849,153,35,39,15,16,1,1,1);V.b.c(24,0,161,57,47,39,10,16,1,1,1);V.b.c(25,0,689,105,41,39,9,16,1,1,1);V.b.c(26,0,929,153,34,39,16,16,1,1,1);V.b.c(27,0,809,153,36,39,12,16,1,1,1);
V.b.c(28,0,553,1,36,50,9,5,1,1,1);V.b.c(29,0,593,1,36,50,9,5,1,1,1);V.b.c(30,0,41,1,36,55,9,0,1,1,1);V.b.c(31,0,689,1,37,49,9,6,1,1,1);V.b.c(32,0,849,1,36,48,9,7,1,1,1);V.b.c(33,0,121,57,36,47,9,8,1,1,1);V.b.c(34,0,633,1,50,39,3,16,1,1,1);V.b.c(35,0,217,57,34,46,14,15,1,1,1);V.b.c(36,0,313,1,33,50,14,5,1,1,1);V.b.c(37,0,241,1,33,50,14,5,1,1,1);V.b.c(38,0,353,1,33,50,14,5,1,1,1);V.b.c(39,0,969,1,33,48,14,7,1,1,1);V.b.c(40,0,281,1,30,50,14,5,1,1,1);V.b.c(41,0,201,1,31,50,14,5,1,1,1);
V.b.c(42,0,161,1,31,50,14,5,1,1,1);V.b.c(43,0,929,1,31,48,14,7,1,1,1);V.b.c(44,0,689,153,36,39,11,16,1,1,1);V.b.c(45,0,729,1,38,49,11,6,1,1,1);V.b.c(46,0,81,1,36,50,12,5,1,1,1);V.b.c(47,0,1,1,36,55,12,0,1,1,1);V.b.c(48,0,433,1,36,50,12,5,1,1,1);V.b.c(49,0,769,1,36,49,12,6,1,1,1);V.b.c(50,0,889,1,36,48,12,7,1,1,1);V.b.c(51,0,689,57,41,44,9,13,1,1,1);V.b.c(52,0,473,1,35,50,13,5,1,1,1);V.b.c(53,0,393,1,35,50,13,5,1,1,1);V.b.c(54,0,513,1,35,50,13,5,1,1,1);V.b.c(55,0,81,57,35,48,13,7,1,1,1);
V.b.c(56,0,121,1,34,50,16,5,1,1,1);V.b.c(57,0,1,161,33,39,13,16,1,1,1);V.b.c(58,0,833,105,32,41,13,14,1,1,1);
V.index=[-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,-1,51,52,53,54,55,56,57,58,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1];
V.left=[23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,22,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,15,15,16,14,17,17,14,14,19,19,15,18,12,14,14,16,14,15,16,17,14,15,9,15,16,17,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,
23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,15,15,15,15,15,15,9,16,17,17,17,17,19,19,19,19,14,14,14,14,14,14,14,23,14,14,14,14,14,16,16,16,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23];
V.width=[12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,14,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,27,27,26,29,24,23,29,30,19,19,27,22,34,30,30,26,30,28,25,24,29,27,40,27,26,24,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,
12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,27,27,27,27,27,27,39,26,24,24,24,24,19,19,19,19,29,30,30,30,30,30,30,12,30,29,29,29,29,26,26,25,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12];V.top=9;V.height=43;V.eh=45;var Ie=new Aa("f_default","fonts/f_default.woff","fonts/f_default.ttf","fonts");window.f_defaultLoader=Ie;var W=new z("f_default","Arial");window.f_default=W;D(W,12);Ea(W);W.setFillColor("Black");
Fa(W,1);Ha(W,!1);W.setStrokeColor("Black");Ja(W,1);La(W,"miter");Ia(W,1);Ka(W,!1);E(W,"left");F(W,"top");Oa(W);Pa(W);var Je=new Aa("ff_opensans_extrabold","fonts/ff_opensans_extrabold.woff","fonts/ff_opensans_extrabold.ttf","fonts");window.ff_opensans_extraboldLoader=Je;var Ke=new Aa("ff_dimbo_regular","fonts/ff_dimbo_regular.woff","fonts/ff_dimbo_regular.ttf","fonts");window.ff_dimbo_regularLoader=Ke;var Le=new Aa("floaterFontFace","fonts/floaterFontFace.woff","fonts/floaterFontFace.ttf","fonts");
window.floaterFontFaceLoader=Le;var Me=new Aa("floaterNumberFontFace","fonts/floaterNumberFontFace.woff","fonts/floaterNumberFontFace.ttf","fonts");window.floaterNumberFontFaceLoader=Me;var Ne=new z("floaterFontFace","Arial");window.floaterFontText1=Ne;D(Ne,24);Da(Ne,"normal");Ea(Ne);Ne.setFillColor("#FFDE00");Fa(Ne,1);Ha(Ne,!0);Ne.setStrokeColor("#6F1F00");Ja(Ne,4);La(Ne,"miter");Ia(Ne,1);Ka(Ne,!0);Ma(Ne,!0,"rgba(57,0,0,0.46)",0,4,2);E(Ne,"left");F(Ne,"top");Oa(Ne);Pa(Ne);
var Oe=new z("floaterFontFace","Arial");window.floaterFontText2=Oe;D(Oe,28);Da(Oe,"normal");Ea(Oe);Ga(Oe,2,["#FFF600","#00DB48","blue"],.65,.02);Fa(Oe,1);Ha(Oe,!0);Oe.setStrokeColor("#073400");Ja(Oe,4);La(Oe,"miter");Ia(Oe,1);Ka(Oe,!0);Ma(Oe,!0,"rgba(0,57,43,0.47)",0,4,2);E(Oe,"left");F(Oe,"top");Oa(Oe);Pa(Oe);var Pe=new z("floaterFontFace","Arial");window.floaterFontText3=Pe;D(Pe,30);Da(Pe,"normal");Ea(Pe);Ga(Pe,3,["#FFF600","#FF8236","#FF0096"],.71,-.1);Fa(Pe,1);Ha(Pe,!0);Pe.setStrokeColor("#4F0027");
Ja(Pe,4);La(Pe,"miter");Ia(Pe,1);Ka(Pe,!0);Ma(Pe,!0,"rgba(41,0,0,0.48)",0,5,2);E(Pe,"left");F(Pe,"top");Oa(Pe);Pa(Pe);var Qe=new z("floaterFontFace","Arial");window.floaterFontText4=Qe;D(Qe,34);Da(Qe,"normal");Ea(Qe);Ga(Qe,3,["#00FCFF","#893DFB","#FF00E4"],.72,-.04);Fa(Qe,1);Ha(Qe,!0);Qe.setStrokeColor("#001637");Ja(Qe,4);La(Qe,"miter");Ia(Qe,1);Ka(Qe,!0);Ma(Qe,!0,"rgba(0,35,75,0.49)",0,6,2);E(Qe,"left");F(Qe,"top");Oa(Qe);Pa(Qe);var Re=new z("floaterNumberFontFace","Arial");
window.floaterFontNumberPositive=Re;D(Re,30);Ea(Re);Re.setFillColor("White");Fa(Re,1);Ha(Re,!0);Re.setStrokeColor("#00106F");Ja(Re,2);La(Re,"miter");Ia(Re,1);Ka(Re,!1);Ma(Re,!0,"rgba(0,4,57,0.51)",0,4,2);E(Re,"left");F(Re,"top");Oa(Re);Pa(Re);var Se=new z("floaterNumberFontFace","Arial");window.floaterFontNumberNegative=Se;D(Se,30);Da(Se,"normal");Ea(Se);Se.setFillColor("#FF1E00");Fa(Se,1);Ha(Se,!0);Se.setStrokeColor("#3F0000");Ja(Se,2);La(Se,"miter");Ia(Se,1);Ka(Se,!1);
Ma(Se,!0,"rgba(57,0,0,0.49)",0,4,2);E(Se,"left");F(Se,"top");Oa(Se);Pa(Se);var Te=new z("ff_opensans_bold","Arial");window.f_game_ui_tiny=Te;D(Te,11);Ea(Te);Te.setFillColor("#799EC5");Fa(Te,1);Ha(Te,!1);Te.setStrokeColor("White");Ja(Te,1);La(Te,"miter");Ia(Te,1);Ka(Te,!1);E(Te,"center");F(Te,"middle");Oa(Te);Pa(Te);var Ue=new z("ff_opensans_bold","Arial");window.f_game_ui=Ue;D(Ue,23);Ea(Ue);Ue.setFillColor("#799EC5");Fa(Ue,1);Ha(Ue,!1);Ue.setStrokeColor("Black");Ja(Ue,1);La(Ue,"miter");Ia(Ue,1);
Ka(Ue,!1);E(Ue,"center");F(Ue,"middle");Oa(Ue);Pa(Ue);var Ve=new z("ff_opensans_bolditalic","Arial");window.f_game_ui_large=Ve;D(Ve,52);Ea(Ve);Ve.setFillColor("#172348");Fa(Ve,1);Ha(Ve,!1);Ve.setStrokeColor("Black");Ja(Ve,1);La(Ve,"miter");Ia(Ve,1);Ka(Ve,!1);E(Ve,"center");F(Ve,"middle");Oa(Ve);Pa(Ve);var We=new Aa("ff_opensans_bold","fonts/ff_opensans_bold.woff","fonts/ff_opensans_bold.ttf","fonts");window.ff_opensans_boldLoader=We;
var Xe=new Aa("ff_opensans_bolditalic","fonts/ff_opensans_bolditalic.woff","fonts/ff_opensans_bolditalic.ttf","fonts");window.ff_opensans_bolditalicLoader=Xe;var Ye=new z("ff_opensans_bold","Arial");window.f_announcement=Ye;D(Ye,70);Ea(Ye);Ye.setFillColor("White");Fa(Ye,1);Ha(Ye,!0);Ye.setStrokeColor("#2C2C2C");Ja(Ye,6);La(Ye,"miter");Ia(Ye,1);Ka(Ye,!0);Ma(Ye,!0,"rgba(0,0,0,0.53)",0,5,2);E(Ye,"center");F(Ye,"top");Oa(Ye);Pa(Ye);var Ze=new z("ff_opensans_bold","Arial");window.f_bubble_points=Ze;
D(Ze,30);Ea(Ze);Ga(Ze,2,["White","#DFDFDF","blue"],.6,0);Fa(Ze,1);Ha(Ze,!0);Ze.setStrokeColor("#454545");Ja(Ze,6);La(Ze,"round");Ia(Ze,1);Ka(Ze,!0);E(Ze,"left");F(Ze,"top");Oa(Ze);Pa(Ze);var $e=new z("ff_opensans_bold","Arial");window.f_bubbles_left=$e;D($e,30);Ea($e);$e.setFillColor("#4E4E4E");Fa($e,1);Ha($e,!1);$e.setStrokeColor("Black");Ja($e,1);La($e,"miter");Ia($e,1);Ka($e,!1);E($e,"center");F($e,"middle");Oa($e);Pa($e);var af=new z("ff_opensans_bold","Arial");window.f_special_points=af;
D(af,40);Ea(af);Ga(af,2,["Yellow","#FF8040","Red"],.6,0);Fa(af,1);Ha(af,!0);af.setStrokeColor("#454545");Ja(af,6);La(af,"round");Ia(af,1);Ka(af,!0);E(af,"left");F(af,"top");Oa(af);Pa(af);var bf=new z("ff_opensans_bold","Arial");window.f_switch=bf;D(bf,16);Ea(bf);bf.setFillColor("#818181");Fa(bf,1);Ha(bf,!1);bf.setStrokeColor("#454545");Ja(bf,1);La(bf,"miter");Ia(bf,1);Ka(bf,!1);E(bf,"left");F(bf,"top");Oa(bf);Pa(bf);var cf=new z("ff_opensans_bolditalic","Arial");window.f_nice=cf;D(cf,70);Da(cf,"normal");
Ea(cf);Ga(cf,2,["#FFF600","#00DB48","blue"],.65,.02);Fa(cf,1);Ha(cf,!0);cf.setStrokeColor("#073400");Ja(cf,7);La(cf,"round");Ia(cf,1);Ka(cf,!0);Ma(cf,!0,"rgba(0,57,43,0.47)",0,4,2);E(cf,"left");F(cf,"top");Oa(cf);Pa(cf);var df=new z("ff_opensans_bolditalic","Arial");window.f_great=df;D(df,75);Da(df,"normal");Ea(df);Ga(df,3,["#FFF600","#FF8236","#FF0096"],.71,-.1);Fa(df,1);Ha(df,!0);df.setStrokeColor("#4F0027");Ja(df,7);La(df,"round");Ia(df,1);Ka(df,!0);Ma(df,!0,"rgba(41,0,0,0.48)",0,5,2);E(df,"left");
F(df,"top");Oa(df);Pa(df);var ef=new z("ff_opensans_bolditalic","Arial");window.f_awesome=ef;D(ef,90);Da(ef,"normal");Ea(ef);Ga(ef,3,["#00FCFF","#893DFB","#FF00E4"],.72,-.04);Fa(ef,1);Ha(ef,!0);ef.setStrokeColor("#001637");Ja(ef,8);La(ef,"round");Ia(ef,1);Ka(ef,!0);Ma(ef,!0,"rgba(0,35,75,0.49)",0,6,2);E(ef,"left");F(ef,"top");Oa(ef);Pa(ef);var ff=new Aa("f_themeDefault","fonts/f_themeDefault.woff","fonts/f_themeDefault.ttf","fonts");window.f_themeDefaultLoader=ff;var gf=new z("f_themeDefault","Arial");
window.f_themeDefault=gf;D(gf,12);Ea(gf);gf.setFillColor("Black");Fa(gf,1);Ha(gf,!1);gf.setStrokeColor("White");Ja(gf,5);La(gf,"miter");Ia(gf,1);Ka(gf,!0);E(gf,"left");F(gf,"top");Oa(gf);Pa(gf);var hf=new z("Arial","Arial");window.f_tap_to_play=hf;D(hf,28);Da(hf,"bold");Ea(hf);hf.setFillColor("#1b2b34");Fa(hf,1);Ha(hf,!1);hf.setStrokeColor("Black");Ja(hf,28);La(hf,"round");Ia(hf,.55);Ka(hf,!1);E(hf,"center");F(hf,"middle");Oa(hf);Pa(hf);var jf=new z("Arial","Arial");window.f_adblocker=jf;D(jf,28);
Da(jf,"normal");Ea(jf);jf.setFillColor("White");Fa(jf,1);Ha(jf,!1);jf.setStrokeColor("Black");Ja(jf,28);La(jf,"round");Ia(jf,.55);Ka(jf,!1);E(jf,"center");F(jf,"middle");Oa(jf);Pa(jf);var kf=new z("Arial","Arial");window.f_copyright=kf;D(kf,22);Da(kf,"bold");Ea(kf);kf.setFillColor("#1b2b34");Fa(kf,1);Ha(kf,!1);kf.setStrokeColor("Black");Ja(kf,28);La(kf,"round");Ia(kf,.55);Ka(kf,!1);E(kf,"left");F(kf,"middle");Oa(kf);Pa(kf);var lf=new z("Arial","Arial");window.f_thankyou=lf;D(lf,50);Da(lf,"bold");
Ea(lf);lf.setFillColor("#1b2b34");Fa(lf,1);Ha(lf,!1);lf.setStrokeColor("Black");Ja(lf,28);La(lf,"round");Ia(lf,.55);Ka(lf,!1);E(lf,"center");F(lf,"middle");Oa(lf);Pa(lf);var mf=new z("Arial","Arial");window.f_loading_game=mf;D(mf,20);Da(mf,"bold");Ea(mf);mf.setFillColor("#1b2b34");Fa(mf,1);Ha(mf,!1);mf.setStrokeColor("Black");Ja(mf,28);La(mf,"round");Ia(mf,.55);Ka(mf,!1);E(mf,"left");F(mf,"middle");Oa(mf);Pa(mf);var nf=new z("Arial","Arial");window.f_interstitial=nf;D(nf,20);Da(nf,"bold");Ea(nf);
nf.setFillColor("#1b2b34");Fa(nf,.38);Ha(nf,!1);nf.setStrokeColor("Black");Ja(nf,28);La(nf,"round");Ia(nf,.55);Ka(nf,!1);E(nf,"center");F(nf,"middle");Oa(nf);Pa(nf);var of=new sb("as_music","audio/as_music.mp3","audio/as_music.ogg","audio_music");window.as_music=of;var X=new sb("audioSprite","audio/audioSprite.mp3","audio/audioSprite.ogg","audio");window.audioSprite=X;var pf=new H("a_music",of,0,34560,1,1,["music"]);window.a_music=pf;var qf=new H("a_bigPop",X,0,1328,1,10,["game"]);
window.a_bigPop=qf;var rf=new H("a_bomb",X,3E3,1247,1,10,["game"]);window.a_bomb=rf;var sf=new H("a_colorBomb",X,6E3,871,1,10,["game"]);window.a_colorBomb=sf;var tf=new H("a_combo_01",X,8E3,598,1,10,["game"]);window.a_combo_01=tf;var uf=new H("a_combo_02",X,1E4,678,1,10,["game"]);window.a_combo_02=uf;var vf=new H("a_combo_03",X,12E3,730,1,10,["game"]);window.a_combo_03=vf;var wf=new H("a_combo_04",X,14E3,1225,1,10,["game"]);window.a_combo_04=wf;var xf=new H("a_fireBallNext",X,17E3,1107,1,10,["game"]);
window.a_fireBallNext=xf;var yf=new H("a_fireBallShoot",X,2E4,968,1,10,["game"]);window.a_fireBallShoot=yf;var zf=new H("a_glassNext",X,22E3,519,1,10,["game"]);window.a_glassNext=zf;var Af=new H("a_hit",X,24E3,54,1,10,["game"]);window.a_hit=Af;var Bf=new H("a_pop_01",X,26E3,145,1,10,["game"]);window.a_pop_01=Bf;var Cf=new H("a_pop_02",X,28E3,140,1,10,["game"]);window.a_pop_02=Cf;var Df=new H("a_pop_03",X,3E4,164,1,10,["game"]);window.a_pop_03=Df;var Ef=new H("a_pop_04",X,32E3,163,1,10,["game"]);
window.a_pop_04=Ef;var Ff=new H("a_pop_05",X,34E3,149,1,10,["game"]);window.a_pop_05=Ff;var Gf=new H("a_pop_06",X,36E3,103,1,10,["game"]);window.a_pop_06=Gf;var Hf=new H("a_shoot",X,38E3,198,1,10,["game"]);window.a_shoot=Hf;var If=new H("a_swap",X,4E4,285,.5,10,["game"]);window.a_swap=If;var Jf=new H("a_floater_popup",X,42E3,306,1,10,["game"]);window.a_floater_popup=Jf;var Kf=new H("a_levelStart",X,44E3,1002,1,10,["sfx"]);window.a_levelStart=Kf;var Mf=new H("a_levelComplete",X,47E3,1002,1,10,["sfx"]);
window.a_levelComplete=Mf;var Nf=new H("a_mouseDown",X,5E4,471,1,10,["sfx"]);window.a_mouseDown=Nf;var Of=new H("a_levelend_star_01",X,52E3,1161,1,10,["sfx"]);window.a_levelend_star_01=Of;var Pf=new H("a_levelend_star_02",X,55E3,1070,1,10,["sfx"]);window.a_levelend_star_02=Pf;var Qf=new H("a_levelend_star_03",X,58E3,1039,1,10,["sfx"]);window.a_levelend_star_03=Qf;var Rf=new H("a_levelend_fail",X,61E3,1572,1,10,["sfx"]);window.a_levelend_fail=Rf;
var Sf=new H("a_levelend_score_counter",X,64E3,54,1,10,["sfx"]);window.a_levelend_score_counter=Sf;var Tf=new H("a_levelend_score_end",X,66E3,888,1,10,["sfx"]);window.a_levelend_score_end=Tf;var Uf=new H("a_medal",X,68E3,1225,1,10,["sfx"]);window.a_medal=Uf;P=P||{};P["nl-nl"]=P["nl-nl"]||{};P["nl-nl"].loadingScreenLoading="Laden...";P["nl-nl"].startScreenPlay="SPELEN";P["nl-nl"].levelMapScreenTotalScore="Totale score";P["nl-nl"].levelEndScreenTitle_level="Level <VALUE>";
P["nl-nl"].levelEndScreenTitle_difficulty="Goed Gedaan!";P["nl-nl"].levelEndScreenTitle_endless="Level <VALUE>";P["nl-nl"].levelEndScreenTotalScore="Totale score";P["nl-nl"].levelEndScreenSubTitle_levelFailed="Level niet gehaald";P["nl-nl"].levelEndScreenTimeLeft="Tijd over";P["nl-nl"].levelEndScreenTimeBonus="Tijdbonus";P["nl-nl"].levelEndScreenHighScore="High score";P["nl-nl"].optionsStartScreen="Hoofdmenu";P["nl-nl"].optionsQuit="Stop";P["nl-nl"].optionsResume="Terug naar spel";
P["nl-nl"].optionsTutorial="Speluitleg";P["nl-nl"].optionsHighScore="High scores";P["nl-nl"].optionsMoreGames="Meer Spellen";P["nl-nl"].optionsDifficulty_easy="Makkelijk";P["nl-nl"].optionsDifficulty_medium="Gemiddeld";P["nl-nl"].optionsDifficulty_hard="Moeilijk";P["nl-nl"].optionsMusic_on="Aan";P["nl-nl"].optionsMusic_off="Uit";P["nl-nl"].optionsSFX_on="Aan";P["nl-nl"].optionsSFX_off="Uit";P["nl-nl"]["optionsLang_en-us"]="Engels (US)";P["nl-nl"]["optionsLang_en-gb"]="Engels (GB)";
P["nl-nl"]["optionsLang_nl-nl"]="Nederlands";P["nl-nl"].gameEndScreenTitle="Gefeliciteerd!\nJe hebt gewonnen.";P["nl-nl"].gameEndScreenBtnText="Ga verder";P["nl-nl"].optionsTitle="Instellingen";P["nl-nl"].optionsQuitConfirmationText="Pas op!\n\nAls je nu stopt verlies je alle voortgang in dit level. Weet je zeker dat je wilt stoppen?";P["nl-nl"].optionsQuitConfirmBtn_No="Nee";P["nl-nl"].optionsQuitConfirmBtn_Yes="Ja, ik weet het zeker";P["nl-nl"].levelMapScreenTitle="Kies een level";
P["nl-nl"].optionsRestartConfirmationText="Pas op!\n\nAls je nu herstart verlies je alle voortgang in dit level. Weet je zeker dat je wilt herstarten?";P["nl-nl"].optionsRestart="Herstart";P["nl-nl"].optionsSFXBig_on="Geluid aan";P["nl-nl"].optionsSFXBig_off="Geluid uit";P["nl-nl"].optionsAbout_title="Over ons";P["nl-nl"].optionsAbout_text="CharmTeam\nlocalplayer.club \nCopyright \u00a9 2020";P["nl-nl"].optionsAbout_backBtn="Terug";P["nl-nl"].optionsAbout_version="versie:";
P["nl-nl"].optionsAbout="Over ons";P["nl-nl"].levelEndScreenMedal="VERBETERD!";P["nl-nl"].startScreenQuestionaire="Wat vind jij?";P["nl-nl"].levelMapScreenWorld_0="Kies een level";P["nl-nl"].startScreenByCharmStudio="door: CharmTeam";P["nl-nl"]["optionsLang_de-de"]="Duits";P["nl-nl"]["optionsLang_tr-tr"]="Turks";P["nl-nl"].optionsAbout_header="Ontwikkeld door:";P["nl-nl"].levelEndScreenViewHighscoreBtn="Scores bekijken";P["nl-nl"].levelEndScreenSubmitHighscoreBtn="Score verzenden";
P["nl-nl"].challengeStartScreenTitle_challengee_friend="Je bent uitgedaagd door:";P["nl-nl"].challengeStartTextScore="Punten van <NAME>:";P["nl-nl"].challengeStartTextTime="Tijd van <NAME>:";P["nl-nl"].challengeStartScreenToWin="Te winnen aantal Fairplay munten:";P["nl-nl"].challengeEndScreenWinnings="Je hebt <AMOUNT> Fairplay munten gewonnen!";P["nl-nl"].challengeEndScreenOutcomeMessage_WON="Je hebt de uitdaging gewonnen!";P["nl-nl"].challengeEndScreenOutcomeMessage_LOST="Je hebt de uitdaging verloren.";
P["nl-nl"].challengeEndScreenOutcomeMessage_TIED="Jullie hebben gelijk gespeeld.";P["nl-nl"].challengeCancelConfirmText="Je staat op het punt de uitdaging te annuleren. Je inzet wordt teruggestort minus de uitdagingskosten. Weet je zeker dat je de uitdaging wilt annuleren? ";P["nl-nl"].challengeCancelConfirmBtn_yes="Ja";P["nl-nl"].challengeCancelConfirmBtn_no="Nee";P["nl-nl"].challengeEndScreensBtn_submit="Verstuur uitdaging";P["nl-nl"].challengeEndScreenBtn_cancel="Annuleer uitdaging";
P["nl-nl"].challengeEndScreenName_you="Jij";P["nl-nl"].challengeEndScreenChallengeSend_error="Er is een fout opgetreden bij het versturen van de uitdaging. Probeer het later nog een keer.";P["nl-nl"].challengeEndScreenChallengeSend_success="Je uitdaging is verstuurd!";P["nl-nl"].challengeCancelMessage_error="Er is een fout opgetreden bij het annuleren van de uitdaging. Probeer het later nog een keer.";P["nl-nl"].challengeCancelMessage_success="De uitdaging is geannuleerd.";
P["nl-nl"].challengeEndScreenScoreSend_error="Er is een fout opgetreden tijdens de communicatie met de server. Probeer het later nog een keer.";P["nl-nl"].challengeStartScreenTitle_challengee_stranger="Jouw tegenstander:";P["nl-nl"].challengeStartScreenTitle_challenger_friend="Jouw tegenstander:";P["nl-nl"].challengeStartScreenTitle_challenger_stranger="Je zet een uitdaging voor:";P["nl-nl"].challengeStartTextTime_challenger="Speel het spel en zet een tijd neer.";
P["nl-nl"].challengeStartTextScore_challenger="Speel het spel en zet een score neer.";P["nl-nl"].challengeForfeitConfirmText="Je staat op het punt de uitdaging op te geven. Weet je zeker dat je dit wilt doen?";P["nl-nl"].challengeForfeitConfirmBtn_yes="Ja";P["nl-nl"].challengeForfeitConfirmBtn_no="Nee";P["nl-nl"].challengeForfeitMessage_success="Je hebt de uitdaging opgegeven.";P["nl-nl"].challengeForfeitMessage_error="Er is een fout opgetreden tijdens het opgeven van de uitdaging. Probeer het later nog een keer.";
P["nl-nl"].optionsChallengeForfeit="Geef op";P["nl-nl"].optionsChallengeCancel="Stop";P["nl-nl"].challengeLoadingError_notValid="Sorry, deze uitdaging kan niet meer gespeeld worden.";P["nl-nl"].challengeLoadingError_notStarted="Kan de server niet bereiken. Probeer het later nog een keer.";P["nl-nl"].levelEndScreenHighScore_time="Beste tijd:";P["nl-nl"].levelEndScreenTotalScore_time="Totale tijd:";P["nl-nl"]["optionsLang_fr-fr"]="Frans";P["nl-nl"]["optionsLang_ko-kr"]="Koreaans";
P["nl-nl"]["optionsLang_ar-eg"]="Arabisch";P["nl-nl"]["optionsLang_es-es"]="Spaans";P["nl-nl"]["optionsLang_pt-br"]="Braziliaans-Portugees";P["nl-nl"]["optionsLang_ru-ru"]="Russisch";P["nl-nl"].optionsExit="Stoppen";P["nl-nl"].levelEndScreenTotalScore_number="Totale score:";P["nl-nl"].levelEndScreenHighScore_number="Topscore:";P["nl-nl"].challengeEndScreenChallengeSend_submessage="<NAME> heeft 72 uur om de uitdaging aan te nemen of te weigeren. Als <NAME> je uitdaging weigert of niet accepteert binnen 72 uur worden je inzet en uitdagingskosten teruggestort.";
P["nl-nl"].challengeEndScreenChallengeSend_submessage_stranger="Als niemand binnen 72 uur je uitdaging accepteert, worden je inzet en uitdagingskosten teruggestort.";P["nl-nl"].challengeForfeitMessage_winnings="<NAME> heeft <AMOUNT> Fairplay munten gewonnen!";P["nl-nl"].optionsAbout_header_publisher="Published by:";P["nl-nl"]["optionsLang_jp-jp"]="Japans";P["nl-nl"]["optionsLang_it-it"]="Italiaans";P["en-us"]=P["en-us"]||{};P["en-us"].loadingScreenLoading="Loading...";P["en-us"].startScreenPlay="PLAY";
P["en-us"].levelMapScreenTotalScore="Total score";P["en-us"].levelEndScreenTitle_level="Level <VALUE>";P["en-us"].levelEndScreenTitle_difficulty="Well done!";P["en-us"].levelEndScreenTitle_endless="Stage <VALUE>";P["en-us"].levelEndScreenTotalScore="Total score";P["en-us"].levelEndScreenSubTitle_levelFailed="Level failed";P["en-us"].levelEndScreenTimeLeft="Time remaining";P["en-us"].levelEndScreenTimeBonus="Time bonus";P["en-us"].levelEndScreenHighScore="High score";
P["en-us"].optionsStartScreen="Main menu";P["en-us"].optionsQuit="Quit";P["en-us"].optionsResume="Resume";P["en-us"].optionsTutorial="How to play";P["en-us"].optionsHighScore="High scores";P["en-us"].optionsMoreGames="More Games";P["en-us"].optionsDifficulty_easy="Easy";P["en-us"].optionsDifficulty_medium="Medium";P["en-us"].optionsDifficulty_hard="Difficult";P["en-us"].optionsMusic_on="On";P["en-us"].optionsMusic_off="Off";P["en-us"].optionsSFX_on="On";P["en-us"].optionsSFX_off="Off";
P["en-us"]["optionsLang_en-us"]="English (US)";P["en-us"]["optionsLang_en-gb"]="English (GB)";P["en-us"]["optionsLang_nl-nl"]="Dutch";P["en-us"].gameEndScreenTitle="Congratulations!\nYou have completed the game.";P["en-us"].gameEndScreenBtnText="Continue";P["en-us"].optionsTitle="Settings";P["en-us"].optionsQuitConfirmationText="Attention!\n\nIf you quit now you will lose all progress made during this level. Are you sure you want to quit?";P["en-us"].optionsQuitConfirmBtn_No="No";
P["en-us"].optionsQuitConfirmBtn_Yes="Yes, I'm sure";P["en-us"].levelMapScreenTitle="Select a level";P["en-us"].optionsRestartConfirmationText="Attention!\n\nIf you restart now you will lose all progress made during this level. Are you sure you want to restart?";P["en-us"].optionsRestart="Restart";P["en-us"].optionsSFXBig_on="Sound on";P["en-us"].optionsSFXBig_off="Sound off";P["en-us"].optionsAbout_title="About";P["en-us"].optionsAbout_text="CharmTeam\nlocalplayer.club \n\u00a9 2020";
P["en-us"].optionsAbout_backBtn="Back";P["en-us"].optionsAbout_version="version:";P["en-us"].optionsAbout="About";P["en-us"].levelEndScreenMedal="IMPROVED!";P["en-us"].startScreenQuestionaire="What do you think?";P["en-us"].levelMapScreenWorld_0="Select a level";P["en-us"].startScreenByCharmStudio="by: CharmTeam";P["en-us"]["optionsLang_de-de"]="German";P["en-us"]["optionsLang_tr-tr"]="Turkish";P["en-us"].optionsAbout_header="Developed by:";P["en-us"].levelEndScreenViewHighscoreBtn="View scores";
P["en-us"].levelEndScreenSubmitHighscoreBtn="Submit score";P["en-us"].challengeStartScreenTitle_challengee_friend="You have been challenged by:";P["en-us"].challengeStartTextScore="<NAME>'s score:";P["en-us"].challengeStartTextTime="<NAME>'s time:";P["en-us"].challengeStartScreenToWin="Amount to win:";P["en-us"].challengeEndScreenWinnings="You have won <AMOUNT> fairpoints";P["en-us"].challengeEndScreenOutcomeMessage_WON="You have won the challenge!";
P["en-us"].challengeEndScreenOutcomeMessage_LOST="You have lost the challenge.";P["en-us"].challengeEndScreenOutcomeMessage_TIED="You tied.";P["en-us"].challengeCancelConfirmText="You are about to cancel the challenge. Your wager will be returned minus the challenge fee. Are you sure you want to cancel the challenge?";P["en-us"].challengeCancelConfirmBtn_yes="Yes";P["en-us"].challengeCancelConfirmBtn_no="No";P["en-us"].challengeEndScreensBtn_submit="Submit challenge";
P["en-us"].challengeEndScreenBtn_cancel="Cancel challenge";P["en-us"].challengeEndScreenName_you="You";P["en-us"].challengeEndScreenChallengeSend_error="An error occured while submitting the challenge. Please try again later.";P["en-us"].challengeEndScreenChallengeSend_success="Your challenge has been sent!";P["en-us"].challengeCancelMessage_error="An error occured while cancelling your challenge. Please try again later.";P["en-us"].challengeCancelMessage_success="Your challenge has been cancelled.";
P["en-us"].challengeEndScreenScoreSend_error="An error occured while communicating with the server. Please try again later.";P["en-us"].challengeStartScreenTitle_challengee_stranger="You have been matched with:";P["en-us"].challengeStartScreenTitle_challenger_friend="You are challenging:";P["en-us"].challengeStartScreenTitle_challenger_stranger="You are setting a score for:";P["en-us"].challengeStartTextTime_challenger="Play the game and set a time.";
P["en-us"].challengeStartTextScore_challenger="Play the game and set a score.";P["en-us"].challengeForfeitConfirmText="You are about to forfeit the challenge. Are you sure you want to proceed?";P["en-us"].challengeForfeitConfirmBtn_yes="Yes";P["en-us"].challengeForfeitConfirmBtn_no="No";P["en-us"].challengeForfeitMessage_success="You have forfeited the challenge.";P["en-us"].challengeForfeitMessage_error="An error occured while forfeiting the challenge. Please try again later.";
P["en-us"].optionsChallengeForfeit="Forfeit";P["en-us"].optionsChallengeCancel="Quit";P["en-us"].challengeLoadingError_notValid="Sorry, this challenge is no longer valid.";P["en-us"].challengeLoadingError_notStarted="Unable to connect to the server. Please try again later.";P["en-us"].levelEndScreenHighScore_time="Best time:";P["en-us"].levelEndScreenTotalScore_time="Total time:";P["en-us"]["optionsLang_fr-fr"]="French";P["en-us"]["optionsLang_ko-kr"]="Korean";P["en-us"]["optionsLang_ar-eg"]="Arabic";
P["en-us"]["optionsLang_es-es"]="Spanish";P["en-us"]["optionsLang_pt-br"]="Brazilian-Portuguese";P["en-us"]["optionsLang_ru-ru"]="Russian";P["en-us"].optionsExit="Exit";P["en-us"].levelEndScreenTotalScore_number="Total score:";P["en-us"].levelEndScreenHighScore_number="High score:";P["en-us"].challengeEndScreenChallengeSend_submessage="<NAME> has 72 hours to accept or decline your challenge. If <NAME> declines or doesn\u2019t accept within 72 hours your wager and challenge fee will be reimbursed.";
P["en-us"].challengeEndScreenChallengeSend_submessage_stranger="If no one accepts your challenge within 72 hours, the amount of your wager and the challenge fee will be returned to you.";P["en-us"].challengeForfeitMessage_winnings="<NAME> has won <AMOUNT> fairpoints!";P["en-us"].optionsAbout_header_publisher="Published by:";P["en-us"]["optionsLang_jp-jp"]="Japanese";P["en-us"]["optionsLang_it-it"]="Italian";P["en-gb"]=P["en-gb"]||{};P["en-gb"].loadingScreenLoading="Loading...";
P["en-gb"].startScreenPlay="PLAY";P["en-gb"].levelMapScreenTotalScore="Total score";P["en-gb"].levelEndScreenTitle_level="Level <VALUE>";P["en-gb"].levelEndScreenTitle_difficulty="Well done!";P["en-gb"].levelEndScreenTitle_endless="Stage <VALUE>";P["en-gb"].levelEndScreenTotalScore="Total score";P["en-gb"].levelEndScreenSubTitle_levelFailed="Level failed";P["en-gb"].levelEndScreenTimeLeft="Time remaining";P["en-gb"].levelEndScreenTimeBonus="Time bonus";P["en-gb"].levelEndScreenHighScore="High score";
P["en-gb"].optionsStartScreen="Main menu";P["en-gb"].optionsQuit="Quit";P["en-gb"].optionsResume="Resume";P["en-gb"].optionsTutorial="How to play";P["en-gb"].optionsHighScore="High scores";P["en-gb"].optionsMoreGames="More Games";P["en-gb"].optionsDifficulty_easy="Easy";P["en-gb"].optionsDifficulty_medium="Medium";P["en-gb"].optionsDifficulty_hard="Difficult";P["en-gb"].optionsMusic_on="On";P["en-gb"].optionsMusic_off="Off";P["en-gb"].optionsSFX_on="On";P["en-gb"].optionsSFX_off="Off";
P["en-gb"]["optionsLang_en-us"]="English (US)";P["en-gb"]["optionsLang_en-gb"]="English (GB)";P["en-gb"]["optionsLang_nl-nl"]="Dutch";P["en-gb"].gameEndScreenTitle="Congratulations!\nYou have completed the game.";P["en-gb"].gameEndScreenBtnText="Continue";P["en-gb"].optionsTitle="Settings";P["en-gb"].optionsQuitConfirmationText="Attention!\n\nIf you quit now you will lose all progress made during this level. Are you sure you want to quit?";P["en-gb"].optionsQuitConfirmBtn_No="No";
P["en-gb"].optionsQuitConfirmBtn_Yes="Yes, I'm sure";P["en-gb"].levelMapScreenTitle="Select a level";P["en-gb"].optionsRestartConfirmationText="Attention!\n\nIf you restart now you will lose all progress made during this level. Are you sure you want to restart?";P["en-gb"].optionsRestart="Restart";P["en-gb"].optionsSFXBig_on="Sound on";P["en-gb"].optionsSFXBig_off="Sound off";P["en-gb"].optionsAbout_title="About";P["en-gb"].optionsAbout_text="CharmTeam\nlocalplayer.club \n\u00a9 2020";
P["en-gb"].optionsAbout_backBtn="Back";P["en-gb"].optionsAbout_version="version:";P["en-gb"].optionsAbout="About";P["en-gb"].levelEndScreenMedal="IMPROVED!";P["en-gb"].startScreenQuestionaire="What do you think?";P["en-gb"].levelMapScreenWorld_0="Select a level";P["en-gb"].startScreenByCharmStudio="by: CharmTeam";P["en-gb"]["optionsLang_de-de"]="German";P["en-gb"]["optionsLang_tr-tr"]="Turkish";P["en-gb"].optionsAbout_header="Developed by:";P["en-gb"].levelEndScreenViewHighscoreBtn="View scores";
P["en-gb"].levelEndScreenSubmitHighscoreBtn="Submit score";P["en-gb"].challengeStartScreenTitle_challengee_friend="You have been challenged by:";P["en-gb"].challengeStartTextScore="<NAME>'s score:";P["en-gb"].challengeStartTextTime="<NAME>'s time:";P["en-gb"].challengeStartScreenToWin="Amount to win:";P["en-gb"].challengeEndScreenWinnings="You have won <AMOUNT> fairpoints";P["en-gb"].challengeEndScreenOutcomeMessage_WON="You have won the challenge!";
P["en-gb"].challengeEndScreenOutcomeMessage_LOST="You have lost the challenge.";P["en-gb"].challengeEndScreenOutcomeMessage_TIED="You tied.";P["en-gb"].challengeCancelConfirmText="You are about to cancel the challenge. Your wager will be returned minus the challenge fee. Are you sure you want to cancel the challenge?";P["en-gb"].challengeCancelConfirmBtn_yes="Yes";P["en-gb"].challengeCancelConfirmBtn_no="No";P["en-gb"].challengeEndScreensBtn_submit="Submit challenge";
P["en-gb"].challengeEndScreenBtn_cancel="Cancel challenge";P["en-gb"].challengeEndScreenName_you="You";P["en-gb"].challengeEndScreenChallengeSend_error="An error occured while submitting the challenge. Please try again later.";P["en-gb"].challengeEndScreenChallengeSend_success="Your challenge has been sent!";P["en-gb"].challengeCancelMessage_error="An error occured while cancelling your challenge. Please try again later.";P["en-gb"].challengeCancelMessage_success="Your challenge has been cancelled.";
P["en-gb"].challengeEndScreenScoreSend_error="An error occured while communicating with the server. Please try again later.";P["en-gb"].challengeStartScreenTitle_challengee_stranger="You have been matched with:";P["en-gb"].challengeStartScreenTitle_challenger_friend="You are challenging:";P["en-gb"].challengeStartScreenTitle_challenger_stranger="You are setting a score for:";P["en-gb"].challengeStartTextTime_challenger="Play the game and set a time.";
P["en-gb"].challengeStartTextScore_challenger="Play the game and set a score.";P["en-gb"].challengeForfeitConfirmText="You are about to forfeit the challenge. Are you sure you wish to proceed?";P["en-gb"].challengeForfeitConfirmBtn_yes="Yes";P["en-gb"].challengeForfeitConfirmBtn_no="No";P["en-gb"].challengeForfeitMessage_success="You have forfeited the challenge.";P["en-gb"].challengeForfeitMessage_error="An error occured while forfeiting the challenge. Please try again later.";
P["en-gb"].optionsChallengeForfeit="Forfeit";P["en-gb"].optionsChallengeCancel="Quit";P["en-gb"].challengeLoadingError_notValid="Sorry, this challenge is no longer valid.";P["en-gb"].challengeLoadingError_notStarted="Unable to connect to the server. Please try again later.";P["en-gb"].levelEndScreenHighScore_time="Best time:";P["en-gb"].levelEndScreenTotalScore_time="Total time:";P["en-gb"]["optionsLang_fr-fr"]="French";P["en-gb"]["optionsLang_ko-kr"]="Korean";P["en-gb"]["optionsLang_ar-eg"]="Arabic";
P["en-gb"]["optionsLang_es-es"]="Spanish";P["en-gb"]["optionsLang_pt-br"]="Brazilian-Portuguese";P["en-gb"]["optionsLang_ru-ru"]="Russian";P["en-gb"].optionsExit="Exit";P["en-gb"].levelEndScreenTotalScore_number="Total score:";P["en-gb"].levelEndScreenHighScore_number="High score:";P["en-gb"].challengeEndScreenChallengeSend_submessage="<NAME> has 72 hours to accept or decline your challenge. If <NAME> declines or doesn\u2019t accept within 72 hours your wager and challenge fee will be reimbursed.";
P["en-gb"].challengeEndScreenChallengeSend_submessage_stranger="If no one accepts your challenge within 72 hours, the amount of your wager and the challenge fee will be returned to you.";P["en-gb"].challengeForfeitMessage_winnings="<NAME> has won <AMOUNT> fairpoints!";P["en-gb"].optionsAbout_header_publisher="Published by:";P["en-gb"]["optionsLang_jp-jp"]="Japanese";P["en-gb"]["optionsLang_it-it"]="Italian";P["de-de"]=P["de-de"]||{};P["de-de"].loadingScreenLoading="Laden ...";
P["de-de"].startScreenPlay="SPIELEN";P["de-de"].levelMapScreenTotalScore="Gesamtpunkte";P["de-de"].levelEndScreenTitle_level="Level <VALUE>";P["de-de"].levelEndScreenTitle_difficulty="Sehr gut!";P["de-de"].levelEndScreenTitle_endless="Stufe <VALUE>";P["de-de"].levelEndScreenTotalScore="Gesamtpunkte";P["de-de"].levelEndScreenSubTitle_levelFailed="Level nicht geschafft";P["de-de"].levelEndScreenTimeLeft="Restzeit";P["de-de"].levelEndScreenTimeBonus="Zeitbonus";P["de-de"].levelEndScreenHighScore="Highscore";
P["de-de"].optionsStartScreen="Hauptmen\u00fc";P["de-de"].optionsQuit="Beenden";P["de-de"].optionsResume="Weiterspielen";P["de-de"].optionsTutorial="So wird gespielt";P["de-de"].optionsHighScore="Highscores";P["de-de"].optionsMoreGames="Weitere Spiele";P["de-de"].optionsDifficulty_easy="Einfach";P["de-de"].optionsDifficulty_medium="Mittel";P["de-de"].optionsDifficulty_hard="Schwer";P["de-de"].optionsMusic_on="EIN";P["de-de"].optionsMusic_off="AUS";P["de-de"].optionsSFX_on="EIN";
P["de-de"].optionsSFX_off="AUS";P["de-de"]["optionsLang_en-us"]="Englisch (US)";P["de-de"]["optionsLang_en-gb"]="Englisch (GB)";P["de-de"]["optionsLang_nl-nl"]="Holl\u00e4ndisch";P["de-de"].gameEndScreenTitle="Gl\u00fcckwunsch!\nDu hast das Spiel abgeschlossen.";P["de-de"].gameEndScreenBtnText="Weiter";P["de-de"].optionsTitle="Einstellungen";P["de-de"].optionsQuitConfirmationText="Achtung!\n\nWenn du jetzt aufh\u00f6rst, verlierst du alle in diesem Level gemachten Fortschritte. Willst du wirklich aufh\u00f6ren?";
P["de-de"].optionsQuitConfirmBtn_No="NEIN";P["de-de"].optionsQuitConfirmBtn_Yes="Ja, ich bin mir sicher";P["de-de"].levelMapScreenTitle="W\u00e4hle ein Level";P["de-de"].optionsRestartConfirmationText="Achtung!\n\nWenn du jetzt neu startest, verlierst du alle in diesem Level gemachten Fortschritte. Willst du wirklich neu starten?";P["de-de"].optionsRestart="Neustart";P["de-de"].optionsSFXBig_on="Sound EIN";P["de-de"].optionsSFXBig_off="Sound AUS";P["de-de"].optionsAbout_title="\u00dcber";
P["de-de"].optionsAbout_text="CharmTeam\nlocalplayer.club \n\u00a9 2020";P["de-de"].optionsAbout_backBtn="Zur\u00fcck";P["de-de"].optionsAbout_version="Version:";P["de-de"].optionsAbout="\u00dcber";P["de-de"].levelEndScreenMedal="VERBESSERT!";P["de-de"].startScreenQuestionaire="Deine Meinung z\u00e4hlt!";P["de-de"].levelMapScreenWorld_0="W\u00e4hle ein Level";P["de-de"].startScreenByCharmStudio="von: CharmTeam";P["de-de"]["optionsLang_de-de"]="Deutsch";P["de-de"]["optionsLang_tr-tr"]="T\u00fcrkisch";
P["de-de"].optionsAbout_header="Entwickelt von:";P["de-de"].levelEndScreenViewHighscoreBtn="Punktzahlen ansehen";P["de-de"].levelEndScreenSubmitHighscoreBtn="Punktzahl senden";P["de-de"].challengeStartScreenTitle_challengee_friend="Dein Gegner:";P["de-de"].challengeStartTextScore="Punktzahl von <NAME>:";P["de-de"].challengeStartTextTime="Zeit von <NAME>:";P["de-de"].challengeStartScreenToWin="Einsatz:";P["de-de"].challengeEndScreenWinnings="Du hast <AMOUNT> Fairm\u00fcnzen gewonnen!";
P["de-de"].challengeEndScreenOutcomeMessage_WON="Du hast die Partie gewonnen!";P["de-de"].challengeEndScreenOutcomeMessage_LOST="Leider hat Dein Gegner die Partie gewonnen.";P["de-de"].challengeEndScreenOutcomeMessage_TIED="Gleichstand!";P["de-de"].challengeCancelConfirmText="Willst Du Deine Wette wirklich zur\u00fcckziehen? Dein Wetteinsatz wird Dir zur\u00fcckgegeben minus die Einsatzgeb\u00fchr.";P["de-de"].challengeCancelConfirmBtn_yes="Ja";P["de-de"].challengeCancelConfirmBtn_no="Nein";
P["de-de"].challengeEndScreensBtn_submit="Herausfordern";P["de-de"].challengeEndScreenBtn_cancel="Zur\u00fcckziehen";P["de-de"].challengeEndScreenName_you="Du";P["de-de"].challengeEndScreenChallengeSend_error="Leider ist ein Fehler aufgetreten. Probiere es bitte nochmal sp\u00e4ter.";P["de-de"].challengeEndScreenChallengeSend_success="Herausforderung verschickt!";P["de-de"].challengeCancelMessage_error="Leider ist ein Fehler aufgetreten. Probiere es bitte nochmal sp\u00e4ter.";
P["de-de"].challengeCancelMessage_success="Du hast die Wette erfolgreich zur\u00fcckgezogen.";P["de-de"].challengeEndScreenScoreSend_error="Leider ist ein Fehler aufgetreten. Probiere es bitte nochmal sp\u00e4ter.";P["de-de"].challengeStartScreenTitle_challengee_stranger="Dein Gegner wird:";P["de-de"].challengeStartScreenTitle_challenger_friend="Du hast den folgenden Spieler herausgefordert:";P["de-de"].challengeStartScreenTitle_challenger_stranger="You are setting a score for:";
P["de-de"].challengeStartTextTime_challenger="Spiel um die niedrigste Zeit!";P["de-de"].challengeStartTextScore_challenger="Spiel um die hochste Punktzahl!";P["de-de"].challengeForfeitConfirmText="Willst du Die Partie wirklich aufgeben?";P["de-de"].challengeForfeitConfirmBtn_yes="Ja";P["de-de"].challengeForfeitConfirmBtn_no="Nein";P["de-de"].challengeForfeitMessage_success="You have forfeited the challenge.";P["de-de"].challengeForfeitMessage_error="Leider ist ein Fehler aufgetreten. Probiere es bitte nochmal sp\u00e4ter.";
P["de-de"].optionsChallengeForfeit="Aufgeben";P["de-de"].optionsChallengeCancel="Zur\u00fcckziehen";P["de-de"].challengeLoadingError_notValid="Leider ist diese Partie nicht mehr aktuel.";P["de-de"].challengeLoadingError_notStarted="Leider ist ein Fehler\u00a0aufgetreten. Es konnte keiner Verbindung zum Server hergestellt werden. Versuche es bitte nochmal sp\u00e4ter.";P["de-de"].levelEndScreenHighScore_time="Bestzeit:";P["de-de"].levelEndScreenTotalScore_time="Gesamtzeit:";
P["de-de"]["optionsLang_fr-fr"]="Franz\u00f6sisch";P["de-de"]["optionsLang_ko-kr"]="Koreanisch";P["de-de"]["optionsLang_ar-eg"]="Arabisch";P["de-de"]["optionsLang_es-es"]="Spanisch";P["de-de"]["optionsLang_pt-br"]="Portugiesisch (Brasilien)";P["de-de"]["optionsLang_ru-ru"]="Russisch";P["de-de"].optionsExit="Verlassen";P["de-de"].levelEndScreenTotalScore_number="Gesamtpunktzahl:";P["de-de"].levelEndScreenHighScore_number="Highscore:";P["de-de"].challengeEndScreenChallengeSend_submessage="<NAME> hat 72 Stunden um die Wette anzunehmen oder abzulehnen. Sollte <NAME> nicht reagieren oder ablehnen werden Dir Dein Wetteinsatz und die Geb\u00fchr zur\u00fcckerstattet.";
P["de-de"].challengeEndScreenChallengeSend_submessage_stranger="Als niemanden Deine Herausforderung innerhalb von 72 Stunden annimmt, werden Dir Deinen Wetteinsatz Einsatzgeb\u00fchr zur\u00fcckerstattet.";P["de-de"].challengeForfeitMessage_winnings="<NAME> has won <AMOUNT> fairpoints!";P["de-de"].optionsAbout_header_publisher="Published by:";P["de-de"]["optionsLang_jp-jp"]="Japanese";P["de-de"]["optionsLang_it-it"]="Italian";P["fr-fr"]=P["fr-fr"]||{};P["fr-fr"].loadingScreenLoading="Chargement...";
P["fr-fr"].startScreenPlay="JOUER";P["fr-fr"].levelMapScreenTotalScore="Score total";P["fr-fr"].levelEndScreenTitle_level="Niveau <VALUE>";P["fr-fr"].levelEndScreenTitle_difficulty="Bien jou\u00e9 !";P["fr-fr"].levelEndScreenTitle_endless="Sc\u00e8ne <VALUE>";P["fr-fr"].levelEndScreenTotalScore="Score total";P["fr-fr"].levelEndScreenSubTitle_levelFailed="\u00c9chec du niveau";P["fr-fr"].levelEndScreenTimeLeft="Temps restant";P["fr-fr"].levelEndScreenTimeBonus="Bonus de temps";
P["fr-fr"].levelEndScreenHighScore="Meilleur score";P["fr-fr"].optionsStartScreen="Menu principal";P["fr-fr"].optionsQuit="Quitter";P["fr-fr"].optionsResume="Reprendre";P["fr-fr"].optionsTutorial="Comment jouer";P["fr-fr"].optionsHighScore="Meilleurs scores";P["fr-fr"].optionsMoreGames="Plus de jeux";P["fr-fr"].optionsDifficulty_easy="Facile";P["fr-fr"].optionsDifficulty_medium="Moyen";P["fr-fr"].optionsDifficulty_hard="Difficile";P["fr-fr"].optionsMusic_on="Avec";P["fr-fr"].optionsMusic_off="Sans";
P["fr-fr"].optionsSFX_on="Avec";P["fr-fr"].optionsSFX_off="Sans";P["fr-fr"]["optionsLang_en-us"]="Anglais (US)";P["fr-fr"]["optionsLang_en-gb"]="Anglais (UK)";P["fr-fr"]["optionsLang_nl-nl"]="N\u00e9erlandais";P["fr-fr"].gameEndScreenTitle="F\u00e9licitations !\nVous avez termin\u00e9 le jeu.";P["fr-fr"].gameEndScreenBtnText="Continuer";P["fr-fr"].optionsTitle="Param\u00e8tres";P["fr-fr"].optionsQuitConfirmationText="Attention !\n\nEn quittant maintenant, vous perdrez votre progression pour le niveau en cours. Quitter quand m\u00eame ?";
P["fr-fr"].optionsQuitConfirmBtn_No="Non";P["fr-fr"].optionsQuitConfirmBtn_Yes="Oui";P["fr-fr"].levelMapScreenTitle="Choisir un niveau";P["fr-fr"].optionsRestartConfirmationText="Attention !\n\nEn recommen\u00e7ant maintenant, vous perdrez votre progression pour le niveau en cours. Recommencer quand m\u00eame ?";P["fr-fr"].optionsRestart="Recommencer";P["fr-fr"].optionsSFXBig_on="Avec son";P["fr-fr"].optionsSFXBig_off="Sans son";P["fr-fr"].optionsAbout_title="\u00c0 propos";
P["fr-fr"].optionsAbout_text="CharmTeam\nlocalplayer.club \n\u00a9 2020";P["fr-fr"].optionsAbout_backBtn="Retour";P["fr-fr"].optionsAbout_version="Version :";P["fr-fr"].optionsAbout="\u00c0 propos";P["fr-fr"].levelEndScreenMedal="RECORD BATTU !";P["fr-fr"].startScreenQuestionaire="Un avis sur le jeu ?";P["fr-fr"].levelMapScreenWorld_0="Choisir un niveau";P["fr-fr"].startScreenByCharmStudio="Un jeu CharmTeam";P["fr-fr"]["optionsLang_de-de"]="Allemand";P["fr-fr"]["optionsLang_tr-tr"]="Turc";
P["fr-fr"].optionsAbout_header="D\u00e9velopp\u00e9 par :";P["fr-fr"].levelEndScreenViewHighscoreBtn="Voir les scores";P["fr-fr"].levelEndScreenSubmitHighscoreBtn="Publier un score";P["fr-fr"].challengeStartScreenTitle_challengee_friend="Votre adversaire\u00a0:";P["fr-fr"].challengeStartTextScore="Son score :";P["fr-fr"].challengeStartTextTime="Son temps\u00a0:";P["fr-fr"].challengeStartScreenToWin="\u00c0 gagner\u00a0:";P["fr-fr"].challengeEndScreenWinnings="Vous avez gagn\u00e9 <AMOUNT> fairpoints.";
P["fr-fr"].challengeEndScreenOutcomeMessage_WON="Vainqueur\u00a0!";P["fr-fr"].challengeEndScreenOutcomeMessage_LOST="Zut\u00a0!";P["fr-fr"].challengeEndScreenOutcomeMessage_TIED="Ex-aequo\u00a0!";P["fr-fr"].challengeCancelConfirmText="Si vous annulez, on vous remboursera le montant du pari moins les frais de pari. Voulez-vous continuer\u00a0? ";P["fr-fr"].challengeCancelConfirmBtn_yes="Oui";P["fr-fr"].challengeCancelConfirmBtn_no="Non";P["fr-fr"].challengeEndScreensBtn_submit="Lancer le d\u00e9fi";
P["fr-fr"].challengeEndScreenBtn_cancel="Annuler le d\u00e9fi";P["fr-fr"].challengeEndScreenName_you="Moi";P["fr-fr"].challengeEndScreenChallengeSend_error="Une erreur est survenue. Veuillez r\u00e9essayer ult\u00e9rieurement.";P["fr-fr"].challengeEndScreenChallengeSend_success="D\u00e9fi lanc\u00e9.";P["fr-fr"].challengeCancelMessage_error="Une erreur est survenue. Veuillez r\u00e9essayer ult\u00e9rieurement.";P["fr-fr"].challengeCancelMessage_success="D\u00e9fi annul\u00e9.";
P["fr-fr"].challengeEndScreenScoreSend_error="Une erreur est survenue. Veuillez r\u00e9essayer ult\u00e9rieurement.";P["fr-fr"].challengeStartScreenTitle_challengee_stranger="Votre adversaire\u00a0:";P["fr-fr"].challengeStartScreenTitle_challenger_friend="Votre adversaire\u00a0:";P["fr-fr"].challengeStartScreenTitle_challenger_stranger="You are setting a score for:";P["fr-fr"].challengeStartTextTime_challenger="Finissez le plus vite possible !";P["fr-fr"].challengeStartTextScore_challenger="Essayez d\u2019atteindre le plus haut score !";
P["fr-fr"].challengeForfeitConfirmText="Voulez-vous vraiment abandonner la partie ?";P["fr-fr"].challengeForfeitConfirmBtn_yes="Oui";P["fr-fr"].challengeForfeitConfirmBtn_no="Non";P["fr-fr"].challengeForfeitMessage_success="Vous avez abandonn\u00e9.";P["fr-fr"].challengeForfeitMessage_error="Une erreur est survenue. Veuillez r\u00e9essayer ult\u00e9rieurement.";P["fr-fr"].optionsChallengeForfeit="Abandonner";P["fr-fr"].optionsChallengeCancel="Annuler";P["fr-fr"].challengeLoadingError_notValid="D\u00e9sol\u00e9, cette partie n'existe plus.";
P["fr-fr"].challengeLoadingError_notStarted="Une erreur de connexion est survenue. Veuillez r\u00e9essayer ult\u00e9rieurement.";P["fr-fr"].levelEndScreenHighScore_time="Meilleur temps :";P["fr-fr"].levelEndScreenTotalScore_time="Temps total :";P["fr-fr"]["optionsLang_fr-fr"]="Fran\u00e7ais";P["fr-fr"]["optionsLang_ko-kr"]="Cor\u00e9en";P["fr-fr"]["optionsLang_ar-eg"]="Arabe";P["fr-fr"]["optionsLang_es-es"]="Espagnol";P["fr-fr"]["optionsLang_pt-br"]="Portugais - Br\u00e9silien";
P["fr-fr"]["optionsLang_ru-ru"]="Russe";P["fr-fr"].optionsExit="Quitter";P["fr-fr"].levelEndScreenTotalScore_number="Score total :";P["fr-fr"].levelEndScreenHighScore_number="Meilleur score :";P["fr-fr"].challengeEndScreenChallengeSend_submessage="<NAME> a 72 heures pour accepter votre d\u00e9fi. Si <NAME> refuse ou n\u2019accepte pas dans ce d\u00e9lai vous serez rembours\u00e9 le montant de votre pari et les frais de pari.";P["fr-fr"].challengeEndScreenChallengeSend_submessage_stranger="Si personne n\u2019accepte votre pari d\u2019ici 72 heures, on vous remboursera le montant du pari y compris les frais.";
P["fr-fr"].challengeForfeitMessage_winnings="<NAME> has won <AMOUNT> fairpoints!";P["fr-fr"].optionsAbout_header_publisher="Published by:";P["fr-fr"]["optionsLang_jp-jp"]="Japanese";P["fr-fr"]["optionsLang_it-it"]="Italian";P["pt-br"]=P["pt-br"]||{};P["pt-br"].loadingScreenLoading="Carregando...";P["pt-br"].startScreenPlay="JOGAR";P["pt-br"].levelMapScreenTotalScore="Pontua\u00e7\u00e3o";P["pt-br"].levelEndScreenTitle_level="N\u00edvel <VALUE>";P["pt-br"].levelEndScreenTitle_difficulty="Muito bem!";
P["pt-br"].levelEndScreenTitle_endless="Fase <VALUE>";P["pt-br"].levelEndScreenTotalScore="Pontua\u00e7\u00e3o";P["pt-br"].levelEndScreenSubTitle_levelFailed="Tente novamente";P["pt-br"].levelEndScreenTimeLeft="Tempo restante";P["pt-br"].levelEndScreenTimeBonus="B\u00f4nus de tempo";P["pt-br"].levelEndScreenHighScore="Recorde";P["pt-br"].optionsStartScreen="Menu principal";P["pt-br"].optionsQuit="Sair";P["pt-br"].optionsResume="Continuar";P["pt-br"].optionsTutorial="Como jogar";
P["pt-br"].optionsHighScore="Recordes";P["pt-br"].optionsMoreGames="Mais jogos";P["pt-br"].optionsDifficulty_easy="F\u00e1cil";P["pt-br"].optionsDifficulty_medium="M\u00e9dio";P["pt-br"].optionsDifficulty_hard="Dif\u00edcil";P["pt-br"].optionsMusic_on="Sim";P["pt-br"].optionsMusic_off="N\u00e3o";P["pt-br"].optionsSFX_on="Sim";P["pt-br"].optionsSFX_off="N\u00e3o";P["pt-br"]["optionsLang_en-us"]="Ingl\u00eas (EUA)";P["pt-br"]["optionsLang_en-gb"]="Ingl\u00eas (GB)";P["pt-br"]["optionsLang_nl-nl"]="Holand\u00eas";
P["pt-br"].gameEndScreenTitle="Parab\u00e9ns!\nVoc\u00ea concluiu o jogo.";P["pt-br"].gameEndScreenBtnText="Continuar";P["pt-br"].optionsTitle="Configura\u00e7\u00f5es";P["pt-br"].optionsQuitConfirmationText="Aten\u00e7\u00e3o!\n\nSe voc\u00ea sair agora, perder\u00e1 todo progresso realizado neste n\u00edvel. Deseja mesmo sair?";P["pt-br"].optionsQuitConfirmBtn_No="N\u00e3o";P["pt-br"].optionsQuitConfirmBtn_Yes="Sim, tenho certeza.";P["pt-br"].levelMapScreenTitle="Selecione um n\u00edvel";
P["pt-br"].optionsRestartConfirmationText="Aten\u00e7\u00e3o!\n\nSe voc\u00ea reiniciar agora, perder\u00e1 todo progresso realizado neste n\u00edvel. Deseja mesmo reiniciar?";P["pt-br"].optionsRestart="Reiniciar";P["pt-br"].optionsSFXBig_on="Com som";P["pt-br"].optionsSFXBig_off="Sem som";P["pt-br"].optionsAbout_title="Sobre";P["pt-br"].optionsAbout_text="CharmTeam\nlocalplayer.club \n\u00a9 2020";P["pt-br"].optionsAbout_backBtn="Voltar";P["pt-br"].optionsAbout_version="vers\u00e3o:";
P["pt-br"].optionsAbout="Sobre";P["pt-br"].levelEndScreenMedal="MELHOROU!";P["pt-br"].startScreenQuestionaire="O que voc\u00ea achou?";P["pt-br"].levelMapScreenWorld_0="Selecione um n\u00edvel";P["pt-br"].startScreenByCharmStudio="da: CharmTeam";P["pt-br"]["optionsLang_de-de"]="Alem\u00e3o";P["pt-br"]["optionsLang_tr-tr"]="Turco";P["pt-br"].optionsAbout_header="Desenvolvido por:";P["pt-br"].levelEndScreenViewHighscoreBtn="Ver pontua\u00e7\u00f5es";P["pt-br"].levelEndScreenSubmitHighscoreBtn="Enviar recorde";
P["pt-br"].challengeStartScreenTitle_challengee_friend="You have been challenged by:";P["pt-br"].challengeStartTextScore="<NAME>'s score:";P["pt-br"].challengeStartTextTime="<NAME>'s time:";P["pt-br"].challengeStartScreenToWin="Amount to win:";P["pt-br"].challengeEndScreenWinnings="You have won <AMOUNT> fairpoints";P["pt-br"].challengeEndScreenOutcomeMessage_WON="You have won the challenge!";P["pt-br"].challengeEndScreenOutcomeMessage_LOST="You have lost the challenge.";
P["pt-br"].challengeEndScreenOutcomeMessage_TIED="You tied.";P["pt-br"].challengeCancelConfirmText="You are about to cancel the challenge. Your wager will be returned minus the challenge fee. Are you sure you want to cancel the challenge?";P["pt-br"].challengeCancelConfirmBtn_yes="Yes";P["pt-br"].challengeCancelConfirmBtn_no="No";P["pt-br"].challengeEndScreensBtn_submit="Submit challenge";P["pt-br"].challengeEndScreenBtn_cancel="Cancel challenge";P["pt-br"].challengeEndScreenName_you="You";
P["pt-br"].challengeEndScreenChallengeSend_error="An error occured while submitting the challenge. Please try again later.";P["pt-br"].challengeEndScreenChallengeSend_success="Your challenge has been sent!";P["pt-br"].challengeCancelMessage_error="An error occured while cancelling your challenge. Please try again later.";P["pt-br"].challengeCancelMessage_success="Your challenge has been cancelled.";P["pt-br"].challengeEndScreenScoreSend_error="An error occured while communicating with the server. Please try again later.";
P["pt-br"].challengeStartScreenTitle_challengee_stranger="You have been matched with:";P["pt-br"].challengeStartScreenTitle_challenger_friend="You are challenging:";P["pt-br"].challengeStartScreenTitle_challenger_stranger="You are setting a score for:";P["pt-br"].challengeStartTextTime_challenger="Play the game and set a time.";P["pt-br"].challengeStartTextScore_challenger="Play the game and set a score.";P["pt-br"].challengeForfeitConfirmText="You are about to forfeit the challenge. Are you sure you want to proceed?";
P["pt-br"].challengeForfeitConfirmBtn_yes="Yes";P["pt-br"].challengeForfeitConfirmBtn_no="No";P["pt-br"].challengeForfeitMessage_success="You have forfeited the challenge.";P["pt-br"].challengeForfeitMessage_error="An error occured while forfeiting the challenge. Please try again later.";P["pt-br"].optionsChallengeForfeit="Desistir";P["pt-br"].optionsChallengeCancel="Sair do Jogo";P["pt-br"].challengeLoadingError_notValid="Desculpe, este desafio n\u00e3o \u00e9 mais v\u00e1lido.";
P["pt-br"].challengeLoadingError_notStarted="Imposs\u00edvel conectar ao servidor. Por favor, tente novamente mais tarde.";P["pt-br"].levelEndScreenHighScore_time="Tempo recorde:";P["pt-br"].levelEndScreenTotalScore_time="Tempo total:";P["pt-br"]["optionsLang_fr-fr"]="Franc\u00eas";P["pt-br"]["optionsLang_ko-kr"]="Coreano";P["pt-br"]["optionsLang_ar-eg"]="\u00c1rabe";P["pt-br"]["optionsLang_es-es"]="Espanhol";P["pt-br"]["optionsLang_pt-br"]="Portugu\u00eas do Brasil";
P["pt-br"]["optionsLang_ru-ru"]="Russo";P["pt-br"].optionsExit="Sa\u00edda";P["pt-br"].levelEndScreenTotalScore_number="Pontua\u00e7\u00e3o total:";P["pt-br"].levelEndScreenHighScore_number="Pontua\u00e7\u00e3o m\u00e1xima:";P["pt-br"].challengeEndScreenChallengeSend_submessage="<NAME> has 72 hours to accept or decline your challenge. If <NAME> declines or doesn\u2019t accept within 72 hours your wager and challenge fee will be reimbursed.";
P["pt-br"].challengeEndScreenChallengeSend_submessage_stranger="If no one accepts your challenge within 72 hours, the amount of your wager and the challenge fee will be returned to you.";P["pt-br"].challengeForfeitMessage_winnings="<NAME> has won <AMOUNT> fairpoints!";P["pt-br"].optionsAbout_header_publisher="Published by:";P["pt-br"]["optionsLang_jp-jp"]="Japanese";P["pt-br"]["optionsLang_it-it"]="Italian";P["es-es"]=P["es-es"]||{};P["es-es"].loadingScreenLoading="Cargando...";
P["es-es"].startScreenPlay="JUGAR";P["es-es"].levelMapScreenTotalScore="Punt. total";P["es-es"].levelEndScreenTitle_level="Nivel <VALUE>";P["es-es"].levelEndScreenTitle_difficulty="\u00a1Muy bien!";P["es-es"].levelEndScreenTitle_endless="Fase <VALUE>";P["es-es"].levelEndScreenTotalScore="Punt. total";P["es-es"].levelEndScreenSubTitle_levelFailed="Nivel fallido";P["es-es"].levelEndScreenTimeLeft="Tiempo restante";P["es-es"].levelEndScreenTimeBonus="Bonif. tiempo";
P["es-es"].levelEndScreenHighScore="R\u00e9cord";P["es-es"].optionsStartScreen="Men\u00fa principal";P["es-es"].optionsQuit="Salir";P["es-es"].optionsResume="Seguir";P["es-es"].optionsTutorial="C\u00f3mo jugar";P["es-es"].optionsHighScore="R\u00e9cords";P["es-es"].optionsMoreGames="M\u00e1s juegos";P["es-es"].optionsDifficulty_easy="F\u00e1cil";P["es-es"].optionsDifficulty_medium="Normal";P["es-es"].optionsDifficulty_hard="Dif\u00edcil";P["es-es"].optionsMusic_on="S\u00ed";
P["es-es"].optionsMusic_off="No";P["es-es"].optionsSFX_on="S\u00ed";P["es-es"].optionsSFX_off="No";P["es-es"]["optionsLang_en-us"]="Ingl\u00e9s (EE.UU.)";P["es-es"]["optionsLang_en-gb"]="Ingl\u00e9s (GB)";P["es-es"]["optionsLang_nl-nl"]="Neerland\u00e9s";P["es-es"].gameEndScreenTitle="\u00a1Enhorabuena!\nHas terminado el juego.";P["es-es"].gameEndScreenBtnText="Continuar";P["es-es"].optionsTitle="Ajustes";P["es-es"].optionsQuitConfirmationText="\u00a1Aviso!\n\nSi sales ahora, perder\u00e1s el progreso que hayas realizado en el nivel. \u00bfSeguro que quieres salir?";
P["es-es"].optionsQuitConfirmBtn_No="No";P["es-es"].optionsQuitConfirmBtn_Yes="S\u00ed, seguro";P["es-es"].levelMapScreenTitle="Elige un nivel";P["es-es"].optionsRestartConfirmationText="\u00a1Aviso!\n\nSi reinicias ahora, perder\u00e1s el progreso que hayas realizado en el nivel. \u00bfSeguro que quieres reiniciar?";P["es-es"].optionsRestart="Reiniciar";P["es-es"].optionsSFXBig_on="Sonido s\u00ed";P["es-es"].optionsSFXBig_off="Sonido no";P["es-es"].optionsAbout_title="Acerca de";
P["es-es"].optionsAbout_text="CharmTeam\nlocalplayer.club \n\u00a9 2020";P["es-es"].optionsAbout_backBtn="Atr\u00e1s";P["es-es"].optionsAbout_version="versi\u00f3n:";P["es-es"].optionsAbout="Acerca de";P["es-es"].levelEndScreenMedal="\u00a1SUPERADO!";P["es-es"].startScreenQuestionaire="\u00bfQu\u00e9 te parece?";P["es-es"].levelMapScreenWorld_0="Elige un nivel";P["es-es"].startScreenByCharmStudio="de: CharmTeam";P["es-es"]["optionsLang_de-de"]="Alem\u00e1n";P["es-es"]["optionsLang_tr-tr"]="Turco";
P["es-es"].optionsAbout_header="Desarrollado por:";P["es-es"].levelEndScreenViewHighscoreBtn="Ver puntuaciones";P["es-es"].levelEndScreenSubmitHighscoreBtn="Enviar puntuaci\u00f3n";P["es-es"].challengeStartScreenTitle_challengee_friend="You have been challenged by:";P["es-es"].challengeStartTextScore="<NAME>'s score:";P["es-es"].challengeStartTextTime="<NAME>'s time:";P["es-es"].challengeStartScreenToWin="Amount to win:";P["es-es"].challengeEndScreenWinnings="You have won <AMOUNT> fairpoints";
P["es-es"].challengeEndScreenOutcomeMessage_WON="You have won the challenge!";P["es-es"].challengeEndScreenOutcomeMessage_LOST="You have lost the challenge.";P["es-es"].challengeEndScreenOutcomeMessage_TIED="You tied.";P["es-es"].challengeCancelConfirmText="You are about to cancel the challenge. Your wager will be returned minus the challenge fee. Are you sure you want to cancel the challenge?";P["es-es"].challengeCancelConfirmBtn_yes="Yes";P["es-es"].challengeCancelConfirmBtn_no="No";
P["es-es"].challengeEndScreensBtn_submit="Submit challenge";P["es-es"].challengeEndScreenBtn_cancel="Cancel challenge";P["es-es"].challengeEndScreenName_you="You";P["es-es"].challengeEndScreenChallengeSend_error="An error occured while submitting the challenge. Please try again later.";P["es-es"].challengeEndScreenChallengeSend_success="Your challenge has been sent!";P["es-es"].challengeCancelMessage_error="An error occured while cancelling your challenge. Please try again later.";
P["es-es"].challengeCancelMessage_success="Your challenge has been cancelled.";P["es-es"].challengeEndScreenScoreSend_error="An error occured while communicating with the server. Please try again later.";P["es-es"].challengeStartScreenTitle_challengee_stranger="You have been matched with:";P["es-es"].challengeStartScreenTitle_challenger_friend="You are challenging:";P["es-es"].challengeStartScreenTitle_challenger_stranger="You are setting a score for:";
P["es-es"].challengeStartTextTime_challenger="Play the game and set a time.";P["es-es"].challengeStartTextScore_challenger="Play the game and set a score.";P["es-es"].challengeForfeitConfirmText="You are about to forfeit the challenge. Are you sure you want to proceed?";P["es-es"].challengeForfeitConfirmBtn_yes="Yes";P["es-es"].challengeForfeitConfirmBtn_no="No";P["es-es"].challengeForfeitMessage_success="You have forfeited the challenge.";P["es-es"].challengeForfeitMessage_error="An error occured while forfeiting the challenge. Please try again later.";
P["es-es"].optionsChallengeForfeit="Rendirse";P["es-es"].optionsChallengeCancel="Abandonar";P["es-es"].challengeLoadingError_notValid="Lo sentimos, este reto ya no es v\u00e1lido.";P["es-es"].challengeLoadingError_notStarted="Imposible conectar con el servidor. Int\u00e9ntalo m\u00e1s tarde.";P["es-es"].levelEndScreenHighScore_time="Mejor tiempo:";P["es-es"].levelEndScreenTotalScore_time="Tiempo total:";P["es-es"]["optionsLang_fr-fr"]="Franc\u00e9s";P["es-es"]["optionsLang_ko-kr"]="Coreano";
P["es-es"]["optionsLang_ar-eg"]="\u00c1rabe";P["es-es"]["optionsLang_es-es"]="Espa\u00f1ol";P["es-es"]["optionsLang_pt-br"]="Portugu\u00e9s brasile\u00f1o";P["es-es"]["optionsLang_ru-ru"]="Ruso";P["es-es"].optionsExit="Salir";P["es-es"].levelEndScreenTotalScore_number="Puntos totales:";P["es-es"].levelEndScreenHighScore_number="Mejor puntuaci\u00f3n:";P["es-es"].challengeEndScreenChallengeSend_submessage="<NAME> has 72 hours to accept or decline your challenge. If <NAME> declines or doesn\u2019t accept within 72 hours your wager and challenge fee will be reimbursed.";
P["es-es"].challengeEndScreenChallengeSend_submessage_stranger="If no one accepts your challenge within 72 hours, the amount of your wager and the challenge fee will be returned to you.";P["es-es"].challengeForfeitMessage_winnings="<NAME> has won <AMOUNT> fairpoints!";P["es-es"].optionsAbout_header_publisher="Published by:";P["es-es"]["optionsLang_jp-jp"]="Japanese";P["es-es"]["optionsLang_it-it"]="Italian";P["tr-tr"]=P["tr-tr"]||{};P["tr-tr"].loadingScreenLoading="Y\u00fckleniyor...";
P["tr-tr"].startScreenPlay="OYNA";P["tr-tr"].levelMapScreenTotalScore="Toplam skor";P["tr-tr"].levelEndScreenTitle_level="Seviye <VALUE>";P["tr-tr"].levelEndScreenTitle_difficulty="Bravo!";P["tr-tr"].levelEndScreenTitle_endless="Seviye <VALUE>";P["tr-tr"].levelEndScreenTotalScore="Toplam skor";P["tr-tr"].levelEndScreenSubTitle_levelFailed="Seviye ba\u015far\u0131s\u0131z";P["tr-tr"].levelEndScreenTimeLeft="Kalan S\u00fcre";P["tr-tr"].levelEndScreenTimeBonus="S\u00fcre Bonusu";
P["tr-tr"].levelEndScreenHighScore="Y\u00fcksek skor";P["tr-tr"].optionsStartScreen="Ana men\u00fc";P["tr-tr"].optionsQuit="\u00c7\u0131k";P["tr-tr"].optionsResume="Devam et";P["tr-tr"].optionsTutorial="Nas\u0131l oynan\u0131r";P["tr-tr"].optionsHighScore="Y\u00fcksek skorlar";P["tr-tr"].optionsMoreGames="Daha Fazla Oyun";P["tr-tr"].optionsDifficulty_easy="Kolay";P["tr-tr"].optionsDifficulty_medium="Orta";P["tr-tr"].optionsDifficulty_hard="Zorluk";P["tr-tr"].optionsMusic_on="A\u00e7\u0131k";
P["tr-tr"].optionsMusic_off="Kapal\u0131";P["tr-tr"].optionsSFX_on="A\u00e7\u0131k";P["tr-tr"].optionsSFX_off="Kapal\u0131";P["tr-tr"]["optionsLang_en-us"]="\u0130ngilizce (US)";P["tr-tr"]["optionsLang_en-gb"]="\u0130ngilizce (GB)";P["tr-tr"]["optionsLang_nl-nl"]="Hollandaca";P["tr-tr"].gameEndScreenTitle="Tebrikler!\nOyunu tamamlad\u0131n.";P["tr-tr"].gameEndScreenBtnText="Devam";P["tr-tr"].optionsTitle="Ayarlar";P["tr-tr"].optionsQuitConfirmationText="Dikkat!\n\u015eimdi \u00e7\u0131karsan bu seviyede yap\u0131lan t\u00fcm ilerleme kaybedilecek. \u00c7\u0131kmak istedi\u011finizden emin misiniz?";
P["tr-tr"].optionsQuitConfirmBtn_No="Hay\u0131r";P["tr-tr"].optionsQuitConfirmBtn_Yes="Evet, eminim";P["tr-tr"].levelMapScreenTitle="Bir seviye se\u00e7";P["tr-tr"].optionsRestartConfirmationText="Dikkat!\n\u015eimdi tekrar ba\u015flarsan bu seviyede yap\u0131lan t\u00fcm ilerleme kaybedilecek. Ba\u015ftan ba\u015flamak istedi\u011finden emin misin?";P["tr-tr"].optionsRestart="Tekrar ba\u015flat";P["tr-tr"].optionsSFXBig_on="Ses a\u00e7\u0131k";P["tr-tr"].optionsSFXBig_off="Ses kapal\u0131";
P["tr-tr"].optionsAbout_title="Hakk\u0131nda";P["tr-tr"].optionsAbout_text="CharmTeam\nlocalplayer.club \n\u00a9 2020";P["tr-tr"].optionsAbout_backBtn="Geri";P["tr-tr"].optionsAbout_version="s\u00fcr\u00fcm:";P["tr-tr"].optionsAbout="Hakk\u0131nda";P["tr-tr"].levelEndScreenMedal="\u0130Y\u0130LE\u015eT\u0130!";P["tr-tr"].startScreenQuestionaire="Ne dersin?";P["tr-tr"].levelMapScreenWorld_0="Bir seviye se\u00e7";P["tr-tr"].startScreenByCharmStudio="taraf\u0131ndan: CharmTeam";
P["tr-tr"]["optionsLang_de-de"]="Almanca";P["tr-tr"]["optionsLang_tr-tr"]="T\u00fcrk\u00e7e";P["tr-tr"].optionsAbout_header="Haz\u0131rlayan:";P["tr-tr"].levelEndScreenViewHighscoreBtn="Puanlar\u0131 g\u00f6ster:";P["tr-tr"].levelEndScreenSubmitHighscoreBtn="Puan g\u00f6nder";P["tr-tr"].challengeStartScreenTitle_challengee_friend="You have been challenged by:";P["tr-tr"].challengeStartTextScore="<NAME>'s score:";P["tr-tr"].challengeStartTextTime="<NAME>'s time:";
P["tr-tr"].challengeStartScreenToWin="Amount to win:";P["tr-tr"].challengeEndScreenWinnings="You have won <AMOUNT> fairpoints";P["tr-tr"].challengeEndScreenOutcomeMessage_WON="You have won the challenge!";P["tr-tr"].challengeEndScreenOutcomeMessage_LOST="You have lost the challenge.";P["tr-tr"].challengeEndScreenOutcomeMessage_TIED="You tied.";P["tr-tr"].challengeCancelConfirmText="You are about to cancel the challenge. Your wager will be returned minus the challenge fee. Are you sure you want to cancel the challenge?";
P["tr-tr"].challengeCancelConfirmBtn_yes="Yes";P["tr-tr"].challengeCancelConfirmBtn_no="No";P["tr-tr"].challengeEndScreensBtn_submit="Submit challenge";P["tr-tr"].challengeEndScreenBtn_cancel="Cancel challenge";P["tr-tr"].challengeEndScreenName_you="You";P["tr-tr"].challengeEndScreenChallengeSend_error="An error occured while submitting the challenge. Please try again later.";P["tr-tr"].challengeEndScreenChallengeSend_success="Your challenge has been sent!";
P["tr-tr"].challengeCancelMessage_error="An error occured while cancelling your challenge. Please try again later.";P["tr-tr"].challengeCancelMessage_success="Your challenge has been cancelled.";P["tr-tr"].challengeEndScreenScoreSend_error="An error occured while communicating with the server. Please try again later.";P["tr-tr"].challengeStartScreenTitle_challengee_stranger="You have been matched with:";P["tr-tr"].challengeStartScreenTitle_challenger_friend="You are challenging:";
P["tr-tr"].challengeStartScreenTitle_challenger_stranger="You are setting a score for:";P["tr-tr"].challengeStartTextTime_challenger="Play the game and set a time.";P["tr-tr"].challengeStartTextScore_challenger="Play the game and set a score.";P["tr-tr"].challengeForfeitConfirmText="You are about to forfeit the challenge. Are you sure you want to proceed?";P["tr-tr"].challengeForfeitConfirmBtn_yes="Yes";P["tr-tr"].challengeForfeitConfirmBtn_no="No";P["tr-tr"].challengeForfeitMessage_success="You have forfeited the challenge.";
P["tr-tr"].challengeForfeitMessage_error="An error occured while forfeiting the challenge. Please try again later.";P["tr-tr"].optionsChallengeForfeit="Vazge\u00e7";P["tr-tr"].optionsChallengeCancel="\u00c7\u0131k\u0131\u015f";P["tr-tr"].challengeLoadingError_notValid="\u00dczg\u00fcn\u00fcz, bu zorluk art\u0131k ge\u00e7erli de\u011fil.";P["tr-tr"].challengeLoadingError_notStarted="Sunucuya ba\u011flan\u0131lam\u0131yor. L\u00fctfen daha sonra tekrar deneyin.";
P["tr-tr"].levelEndScreenHighScore_time="En \u0130yi Zaman:";P["tr-tr"].levelEndScreenTotalScore_time="Toplam Zaman:";P["tr-tr"]["optionsLang_fr-fr"]="Frans\u0131zca";P["tr-tr"]["optionsLang_ko-kr"]="Korece";P["tr-tr"]["optionsLang_ar-eg"]="Arap\u00e7a";P["tr-tr"]["optionsLang_es-es"]="\u0130spanyolca";P["tr-tr"]["optionsLang_pt-br"]="Brezilya Portekizcesi";P["tr-tr"]["optionsLang_ru-ru"]="Rus\u00e7a";P["tr-tr"].optionsExit="\u00c7\u0131k\u0131\u015f";P["tr-tr"].levelEndScreenTotalScore_number="Toplam Puan:";
P["tr-tr"].levelEndScreenHighScore_number="Y\u00fcksek Puan:";P["tr-tr"].challengeEndScreenChallengeSend_submessage="<NAME> has 72 hours to accept or decline your challenge. If <NAME> declines or doesn\u2019t accept within 72 hours your wager and challenge fee will be reimbursed.";P["tr-tr"].challengeEndScreenChallengeSend_submessage_stranger="If no one accepts your challenge within 72 hours, the amount of your wager and the challenge fee will be returned to you.";
P["tr-tr"].challengeForfeitMessage_winnings="<NAME> has won <AMOUNT> fairpoints!";P["tr-tr"].optionsAbout_header_publisher="Published by:";P["tr-tr"]["optionsLang_jp-jp"]="Japanese";P["tr-tr"]["optionsLang_it-it"]="Italian";P["ru-ru"]=P["ru-ru"]||{};P["ru-ru"].loadingScreenLoading="\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...";P["ru-ru"].startScreenPlay="\u0418\u0413\u0420\u0410\u0422\u042c";P["ru-ru"].levelMapScreenTotalScore="\u041e\u0431\u0449\u0438\u0439 \u0441\u0447\u0435\u0442";
P["ru-ru"].levelEndScreenTitle_level="\u0423\u0440\u043e\u0432\u0435\u043d\u044c <VALUE>";P["ru-ru"].levelEndScreenTitle_difficulty="\u0425\u043e\u0440\u043e\u0448\u0438\u0439 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442!";P["ru-ru"].levelEndScreenTitle_endless="\u042d\u0442\u0430\u043f <VALUE>";P["ru-ru"].levelEndScreenTotalScore="\u041e\u0431\u0449\u0438\u0439 \u0441\u0447\u0435\u0442";P["ru-ru"].levelEndScreenSubTitle_levelFailed="\u0423\u0440\u043e\u0432\u0435\u043d\u044c \u043d\u0435 \u043f\u0440\u043e\u0439\u0434\u0435\u043d";
P["ru-ru"].levelEndScreenTimeLeft="\u041e\u0441\u0442\u0430\u0432\u0448\u0435\u0435\u0441\u044f \u0432\u0440\u0435\u043c\u044f";P["ru-ru"].levelEndScreenTimeBonus="\u0414\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0435 \u0432\u0440\u0435\u043c\u044f";P["ru-ru"].levelEndScreenHighScore="\u0420\u0435\u043a\u043e\u0440\u0434";P["ru-ru"].optionsStartScreen="\u0413\u043b\u0430\u0432\u043d\u043e\u0435 \u043c\u0435\u043d\u044e";P["ru-ru"].optionsQuit="\u0412\u044b\u0439\u0442\u0438";
P["ru-ru"].optionsResume="\u041f\u0440\u043e\u0434\u043e\u043b\u0436\u0438\u0442\u044c";P["ru-ru"].optionsTutorial="\u041a\u0430\u043a \u0438\u0433\u0440\u0430\u0442\u044c";P["ru-ru"].optionsHighScore="\u0420\u0435\u043a\u043e\u0440\u0434\u044b";P["ru-ru"].optionsMoreGames="\u0411\u043e\u043b\u044c\u0448\u0435 \u0438\u0433\u0440";P["ru-ru"].optionsDifficulty_easy="\u041b\u0435\u0433\u043a\u0438\u0439";P["ru-ru"].optionsDifficulty_medium="\u0421\u0440\u0435\u0434\u043d\u0438\u0439";
P["ru-ru"].optionsDifficulty_hard="\u0421\u043b\u043e\u0436\u043d\u044b\u0439";P["ru-ru"].optionsMusic_on="\u0412\u043a\u043b.";P["ru-ru"].optionsMusic_off="\u0412\u044b\u043a\u043b.";P["ru-ru"].optionsSFX_on="\u0412\u043a\u043b.";P["ru-ru"].optionsSFX_off="\u0412\u044b\u043a\u043b.";P["ru-ru"]["optionsLang_en-us"]="\u0410\u043d\u0433\u043b\u0438\u0439\u0441\u043a\u0438\u0439 (\u0421\u0428\u0410)";P["ru-ru"]["optionsLang_en-gb"]="\u0410\u043d\u0433\u043b\u0438\u0439\u0441\u043a\u0438\u0439 (\u0412\u0411)";
P["ru-ru"]["optionsLang_nl-nl"]="\u041d\u0438\u0434\u0435\u0440\u043b\u0430\u043d\u0434\u0441\u043a\u0438\u0439";P["ru-ru"].gameEndScreenTitle="\u041f\u043e\u0437\u0434\u0440\u0430\u0432\u043b\u044f\u0435\u043c!\n\u0412\u044b \u043f\u0440\u043e\u0448\u043b\u0438 \u0438\u0433\u0440\u0443.";P["ru-ru"].gameEndScreenBtnText="\u041f\u0440\u043e\u0434\u043e\u043b\u0436\u0438\u0442\u044c";P["ru-ru"].optionsTitle="\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438";
P["ru-ru"].optionsQuitConfirmationText="\u0412\u043d\u0438\u043c\u0430\u043d\u0438\u0435!\n\n\u0415\u0441\u043b\u0438 \u0432\u044b \u0432\u044b\u0439\u0434\u0435\u0442\u0435 \u0441\u0435\u0439\u0447\u0430\u0441, \u0443\u0440\u043e\u0432\u0435\u043d\u044c \u043d\u0435 \u0431\u0443\u0434\u0435\u0442 \u0437\u0430\u0441\u0447\u0438\u0442\u0430\u043d. \u0412\u044b \u0443\u0432\u0435\u0440\u0435\u043d\u044b, \u0447\u0442\u043e \u0445\u043e\u0442\u0438\u0442\u0435 \u0432\u044b\u0439\u0442\u0438?";
P["ru-ru"].optionsQuitConfirmBtn_No="\u041d\u0435\u0442";P["ru-ru"].optionsQuitConfirmBtn_Yes="\u0414\u0430, \u0432\u044b\u0439\u0442\u0438";P["ru-ru"].levelMapScreenTitle="\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0443\u0440\u043e\u0432\u0435\u043d\u044c";P["ru-ru"].optionsRestartConfirmationText="\u0412\u043d\u0438\u043c\u0430\u043d\u0438\u0435!\n\n\u0415\u0441\u043b\u0438 \u0432\u044b \u0441\u0435\u0439\u0447\u0430\u0441 \u043d\u0430\u0447\u043d\u0435\u0442\u0435 \u0438\u0433\u0440\u0443 \u0437\u0430\u043d\u043e\u0432\u043e, \u0443\u0440\u043e\u0432\u0435\u043d\u044c \u043d\u0435 \u0431\u0443\u0434\u0435\u0442 \u0437\u0430\u0441\u0447\u0438\u0442\u0430\u043d. \u0412\u044b \u0443\u0432\u0435\u0440\u0435\u043d\u044b, \u0447\u0442\u043e \u0445\u043e\u0442\u0438\u0442\u0435 \u043d\u0430\u0447\u0430\u0442\u044c \u0437\u0430\u043d\u043e\u0432\u043e?";
P["ru-ru"].optionsRestart="\u0417\u0430\u043d\u043e\u0432\u043e";P["ru-ru"].optionsSFXBig_on="\u0417\u0432\u0443\u043a \u0432\u043a\u043b.";P["ru-ru"].optionsSFXBig_off="\u0417\u0432\u0443\u043a \u0432\u044b\u043a\u043b.";P["ru-ru"].optionsAbout_title="\u041e \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0435";P["ru-ru"].optionsAbout_text="\u00a9 CharmTeam\nlocalplayer.club \u00820";P["ru-ru"].optionsAbout_backBtn="\u041d\u0430\u0437\u0430\u0434";P["ru-ru"].optionsAbout_version="\u0412\u0435\u0440\u0441\u0438\u044f:";
P["ru-ru"].optionsAbout="\u041e \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0435";P["ru-ru"].levelEndScreenMedal="\u041d\u041e\u0412\u042b\u0419 \u0420\u0415\u041a\u041e\u0420\u0414!";P["ru-ru"].startScreenQuestionaire="\u041a\u0430\u043a \u0432\u0430\u043c \u0438\u0433\u0440\u0430?";P["ru-ru"].levelMapScreenWorld_0="\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0443\u0440\u043e\u0432\u0435\u043d\u044c";P["ru-ru"].startScreenByCharmStudio="\u0420\u0430\u0437\u0440\u0430\u0431\u043e\u0442\u0447\u0438\u043a\u0438: CharmTeam";
P["ru-ru"]["optionsLang_de-de"]="\u041d\u0435\u043c\u0435\u0446\u043a\u0438\u0439";P["ru-ru"]["optionsLang_tr-tr"]="\u0422\u0443\u0440\u0435\u0446\u043a\u0438\u0439";P["ru-ru"].optionsAbout_header="Developed by:";P["ru-ru"].levelEndScreenViewHighscoreBtn="View scores";P["ru-ru"].levelEndScreenSubmitHighscoreBtn="Submit score";P["ru-ru"].challengeStartScreenTitle_challengee_friend="You have been challenged by:";P["ru-ru"].challengeStartTextScore="<NAME>'s score:";
P["ru-ru"].challengeStartTextTime="<NAME>'s time:";P["ru-ru"].challengeStartScreenToWin="Amount to win:";P["ru-ru"].challengeEndScreenWinnings="You have won <AMOUNT> fairpoints";P["ru-ru"].challengeEndScreenOutcomeMessage_WON="You have won the challenge!";P["ru-ru"].challengeEndScreenOutcomeMessage_LOST="You have lost the challenge.";P["ru-ru"].challengeEndScreenOutcomeMessage_TIED="You tied.";P["ru-ru"].challengeCancelConfirmText="You are about to cancel the challenge. Your wager will be returned minus the challenge fee. Are you sure you want to cancel the challenge?";
P["ru-ru"].challengeCancelConfirmBtn_yes="Yes";P["ru-ru"].challengeCancelConfirmBtn_no="No";P["ru-ru"].challengeEndScreensBtn_submit="Submit challenge";P["ru-ru"].challengeEndScreenBtn_cancel="Cancel challenge";P["ru-ru"].challengeEndScreenName_you="You";P["ru-ru"].challengeEndScreenChallengeSend_error="An error occured while submitting the challenge. Please try again later.";P["ru-ru"].challengeEndScreenChallengeSend_success="Your challenge has been sent!";
P["ru-ru"].challengeCancelMessage_error="An error occured while cancelling your challenge. Please try again later.";P["ru-ru"].challengeCancelMessage_success="Your challenge has been cancelled.";P["ru-ru"].challengeEndScreenScoreSend_error="An error occured while communicating with the server. Please try again later.";P["ru-ru"].challengeStartScreenTitle_challengee_stranger="You have been matched with:";P["ru-ru"].challengeStartScreenTitle_challenger_friend="You are challenging:";
P["ru-ru"].challengeStartScreenTitle_challenger_stranger="You are setting a score for:";P["ru-ru"].challengeStartTextTime_challenger="Play the game and set a time.";P["ru-ru"].challengeStartTextScore_challenger="Play the game and set a score.";P["ru-ru"].challengeForfeitConfirmText="You are about to forfeit the challenge. Are you sure you want to proceed?";P["ru-ru"].challengeForfeitConfirmBtn_yes="Yes";P["ru-ru"].challengeForfeitConfirmBtn_no="No";P["ru-ru"].challengeForfeitMessage_success="You have forfeited the challenge.";
P["ru-ru"].challengeForfeitMessage_error="An error occured while forfeiting the challenge. Please try again later.";P["ru-ru"].optionsChallengeForfeit="Forfeit";P["ru-ru"].optionsChallengeCancel="Quit";P["ru-ru"].challengeLoadingError_notValid="Sorry, this challenge is no longer valid.";P["ru-ru"].challengeLoadingError_notStarted="Unable to connect to the server. Please try again later.";P["ru-ru"].levelEndScreenHighScore_time="Best time:";P["ru-ru"].levelEndScreenTotalScore_time="Total time:";
P["ru-ru"]["optionsLang_fr-fr"]="\u0424\u0440\u0430\u043d\u0446\u0443\u0437\u0441\u043a\u0438\u0439";P["ru-ru"]["optionsLang_ko-kr"]="\u041a\u043e\u0440\u0435\u0439\u0441\u043a\u0438\u0439";P["ru-ru"]["optionsLang_ar-eg"]="\u0410\u0440\u0430\u0431\u0441\u043a\u0438\u0439";P["ru-ru"]["optionsLang_es-es"]="\u0418\u0441\u043f\u0430\u043d\u0441\u043a\u0438\u0439";P["ru-ru"]["optionsLang_pt-br"]="\u0411\u0440\u0430\u0437\u0438\u043b\u044c\u0441\u043a\u0438\u0439 \u043f\u043e\u0440\u0442\u0443\u0433\u0430\u043b\u044c\u0441\u043a\u0438\u0439";
P["ru-ru"]["optionsLang_ru-ru"]="\u0420\u0443\u0441\u0441\u043a\u0438\u0439";P["ru-ru"].optionsExit="Exit";P["ru-ru"].levelEndScreenTotalScore_number="Total score:";P["ru-ru"].levelEndScreenHighScore_number="High score:";P["ru-ru"].challengeEndScreenChallengeSend_submessage="<NAME> has 72 hours to accept or decline your challenge. If <NAME> declines or doesn\u2019t accept within 72 hours your wager and challenge fee will be reimbursed.";
P["ru-ru"].challengeEndScreenChallengeSend_submessage_stranger="If no one accepts your challenge within 72 hours, the amount of your wager and the challenge fee will be returned to you.";P["ru-ru"].challengeForfeitMessage_winnings="<NAME> has won <AMOUNT> fairpoints!";P["ru-ru"].optionsAbout_header_publisher="Published by:";P["ru-ru"]["optionsLang_jp-jp"]="Japanese";P["ru-ru"]["optionsLang_it-it"]="Italian";P["ar-eg"]=P["ar-eg"]||{};P["ar-eg"].loadingScreenLoading="\u064a\u062a\u0645 \u0627\u0644\u0622\u0646 \u0627\u0644\u062a\u062d\u0645\u064a\u0644...";
P["ar-eg"].startScreenPlay="\u062a\u0634\u063a\u064a\u0644";P["ar-eg"].levelMapScreenTotalScore="\u0627\u0644\u0646\u062a\u064a\u062c\u0629 \u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a\u0629";P["ar-eg"].levelEndScreenTitle_level="\u0627\u0644\u0645\u0633\u062a\u0648\u0649 <VALUE>";P["ar-eg"].levelEndScreenTitle_difficulty="\u0623\u062d\u0633\u0646\u062a!";P["ar-eg"].levelEndScreenTitle_endless="\u0627\u0644\u0645\u0631\u062d\u0644\u0629 <VALUE>";P["ar-eg"].levelEndScreenTotalScore="\u0627\u0644\u0646\u062a\u064a\u062c\u0629 \u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a\u0629";
P["ar-eg"].levelEndScreenSubTitle_levelFailed="\u0644\u0642\u062f \u0641\u0634\u0644\u062a \u0641\u064a \u0627\u062c\u062a\u064a\u0627\u0632 \u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u062a\u0648\u0649";P["ar-eg"].levelEndScreenTimeLeft="\u0627\u0644\u0648\u0642\u062a \u0627\u0644\u0645\u062a\u0628\u0642\u064a";P["ar-eg"].levelEndScreenTimeBonus="\u0645\u0643\u0627\u0641\u0623\u0629 \u0627\u0644\u0648\u0642\u062a";P["ar-eg"].levelEndScreenHighScore="\u0623\u0639\u0644\u0649 \u0646\u062a\u064a\u062c\u0629";
P["ar-eg"].optionsStartScreen="\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629";P["ar-eg"].optionsQuit="\u0627\u0644\u062e\u0631\u0648\u062c \u0645\u0646 \u0627\u0644\u0644\u0639\u0628\u0629";P["ar-eg"].optionsResume="\u0627\u0633\u062a\u0626\u0646\u0627\u0641";P["ar-eg"].optionsTutorial="\u0637\u0631\u064a\u0642\u0629 \u0627\u0644\u0644\u0639\u0628";P["ar-eg"].optionsHighScore="\u0623\u0639\u0644\u0649 \u0627\u0644\u0646\u062a\u0627\u0626\u062c";
P["ar-eg"].optionsMoreGames="\u0627\u0644\u0645\u0632\u064a\u062f \u0645\u0646 \u0627\u0644\u0623\u0644\u0639\u0627\u0628";P["ar-eg"].optionsDifficulty_easy="\u0633\u0647\u0644";P["ar-eg"].optionsDifficulty_medium="\u0645\u062a\u0648\u0633\u0637";P["ar-eg"].optionsDifficulty_hard="\u0635\u0639\u0628";P["ar-eg"].optionsMusic_on="\u062a\u0634\u063a\u064a\u0644 \u0627\u0644\u0645\u0648\u0633\u064a\u0642\u0649";P["ar-eg"].optionsMusic_off="\u0625\u064a\u0642\u0627\u0641 \u0627\u0644\u0645\u0648\u0633\u064a\u0642\u0649";
P["ar-eg"].optionsSFX_on="\u062a\u0634\u063a\u064a\u0644 \u0627\u0644\u0645\u0624\u062b\u0631\u0627\u062a \u0627\u0644\u0635\u0648\u062a\u064a\u0629";P["ar-eg"].optionsSFX_off="\u0625\u064a\u0642\u0627\u0641 \u0627\u0644\u0645\u0624\u062b\u0631\u0627\u062a \u0627\u0644\u0635\u0648\u062a\u064a\u0629";P["ar-eg"]["optionsLang_en-us"]="\u0627\u0644\u0625\u0646\u062c\u0644\u064a\u0632\u064a\u0629 (\u0627\u0644\u0648\u0644\u0627\u064a\u0627\u062a \u0627\u0644\u0645\u062a\u062d\u062f\u0629)";
P["ar-eg"]["optionsLang_en-gb"]="\u0627\u0644\u0625\u0646\u062c\u0644\u064a\u0632\u064a\u0629 (\u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0645\u062a\u062d\u062f\u0629)";P["ar-eg"]["optionsLang_nl-nl"]="\u0627\u0644\u0647\u0648\u0644\u0646\u062f\u064a\u0629";P["ar-eg"].gameEndScreenTitle="\u062a\u0647\u0627\u0646\u064a\u0646\u0627!\n\u0644\u0642\u062f \u0623\u0643\u0645\u0644\u062a \u0627\u0644\u0644\u0639\u0628\u0629.";P["ar-eg"].gameEndScreenBtnText="\u0645\u062a\u0627\u0628\u0639\u0629";
P["ar-eg"].optionsTitle="\u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a";P["ar-eg"].optionsQuitConfirmationText="\u0627\u0646\u062a\u0628\u0647!n\n\u0625\u0630\u0627 \u062e\u0631\u062c\u062a \u0645\u0646 \u0627\u0644\u0644\u0639\u0628\u0629 \u0627\u0644\u0622\u0646\u060c \u0641\u0633\u062a\u0641\u0642\u062f \u0643\u0644 \u0627\u0644\u062a\u0642\u062f\u0645 \u0627\u0644\u0630\u064a \u0623\u062d\u0631\u0632\u062a\u0647 \u062e\u0644\u0627\u0644 \u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u062a\u0648\u0649. \u0647\u0644 \u0623\u0646\u062a \u0645\u062a\u0623\u0643\u062f \u0645\u0646 \u0623\u0646\u0643 \u062a\u0631\u064a\u062f \u0627\u0644\u062e\u0631\u0648\u062c \u0645\u0646 \u0627\u0644\u0644\u0639\u0628\u0629\u061f";
P["ar-eg"].optionsQuitConfirmBtn_No="\u0644\u0627";P["ar-eg"].optionsQuitConfirmBtn_Yes="\u0646\u0639\u0645\u060c \u0645\u062a\u0623\u0643\u062f";P["ar-eg"].levelMapScreenTitle="\u062a\u062d\u062f\u064a\u062f \u0645\u0633\u062a\u0648\u0649";P["ar-eg"].optionsRestartConfirmationText="\u0627\u0646\u062a\u0628\u0647!\n\n\u0625\u0630\u0627 \u0642\u0645\u062a \u0628\u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062a\u0634\u063a\u064a\u0644 \u0627\u0644\u0622\u0646\u060c \u0641\u0633\u062a\u0641\u0642\u062f \u0643\u0644 \u0627\u0644\u062a\u0642\u062f\u0645 \u0627\u0644\u0630\u064a \u0623\u062d\u0631\u0632\u062a\u0647 \u062e\u0644\u0627\u0644 \u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u062a\u0648\u0649. \u0647\u0644 \u0623\u0646\u062a \u0645\u062a\u0623\u0643\u062f \u0645\u0646 \u0623\u0646\u0643 \u062a\u0631\u064a\u062f \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062a\u0634\u063a\u064a\u0644\u061f";
P["ar-eg"].optionsRestart="\u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062a\u0634\u063a\u064a\u0644";P["ar-eg"].optionsSFXBig_on="\u062a\u0634\u063a\u064a\u0644 \u0627\u0644\u0635\u0648\u062a";P["ar-eg"].optionsSFXBig_off="\u0625\u064a\u0642\u0627\u0641 \u0627\u0644\u0635\u0648\u062a";P["ar-eg"].optionsAbout_title="\u062d\u0648\u0644";P["ar-eg"].optionsAbout_text="CharmTeam\nlocalplayer.club \n\u00a9 2020";P["ar-eg"].optionsAbout_backBtn="\u0627\u0644\u0633\u0627\u0628\u0642";
P["ar-eg"].optionsAbout_version="\u0627\u0644\u0625\u0635\u062f\u0627\u0631:";P["ar-eg"].optionsAbout="\u062d\u0648\u0644";P["ar-eg"].levelEndScreenMedal="\u0644\u0642\u062f \u062a\u062d\u0633\u0651\u0646\u062a!";P["ar-eg"].startScreenQuestionaire="\u0645\u0627 \u0631\u0623\u064a\u0643\u061f";P["ar-eg"].levelMapScreenWorld_0="\u062a\u062d\u062f\u064a\u062f \u0645\u0633\u062a\u0648\u0649";P["ar-eg"].startScreenByCharmStudio="\u0628\u0648\u0627\u0633\u0637\u0629: CharmTeam";
P["ar-eg"]["optionsLang_de-de"]="\u0627\u0644\u0623\u0644\u0645\u0627\u0646\u064a\u0629";P["ar-eg"]["optionsLang_tr-tr"]="\u0627\u0644\u062a\u0631\u0643\u064a\u0629";P["ar-eg"].optionsAbout_header="Developed by:";P["ar-eg"].levelEndScreenViewHighscoreBtn="View scores";P["ar-eg"].levelEndScreenSubmitHighscoreBtn="Submit score";P["ar-eg"].challengeStartScreenTitle_challengee_friend="You have been challenged by:";P["ar-eg"].challengeStartTextScore="<NAME>'s score:";
P["ar-eg"].challengeStartTextTime="<NAME>'s time:";P["ar-eg"].challengeStartScreenToWin="Amount to win:";P["ar-eg"].challengeEndScreenWinnings="You have won <AMOUNT> fairpoints";P["ar-eg"].challengeEndScreenOutcomeMessage_WON="You have won the challenge!";P["ar-eg"].challengeEndScreenOutcomeMessage_LOST="You have lost the challenge.";P["ar-eg"].challengeEndScreenOutcomeMessage_TIED="You tied.";P["ar-eg"].challengeCancelConfirmText="You are about to cancel the challenge. Your wager will be returned minus the challenge fee. Are you sure you want to cancel the challenge?";
P["ar-eg"].challengeCancelConfirmBtn_yes="Yes";P["ar-eg"].challengeCancelConfirmBtn_no="No";P["ar-eg"].challengeEndScreensBtn_submit="Submit challenge";P["ar-eg"].challengeEndScreenBtn_cancel="Cancel challenge";P["ar-eg"].challengeEndScreenName_you="You";P["ar-eg"].challengeEndScreenChallengeSend_error="An error occured while submitting the challenge. Please try again later.";P["ar-eg"].challengeEndScreenChallengeSend_success="Your challenge has been sent!";
P["ar-eg"].challengeCancelMessage_error="An error occured while cancelling your challenge. Please try again later.";P["ar-eg"].challengeCancelMessage_success="Your challenge has been cancelled.";P["ar-eg"].challengeEndScreenScoreSend_error="An error occured while communicating with the server. Please try again later.";P["ar-eg"].challengeStartScreenTitle_challengee_stranger="You have been matched with:";P["ar-eg"].challengeStartScreenTitle_challenger_friend="You are challenging:";
P["ar-eg"].challengeStartScreenTitle_challenger_stranger="You are setting a score for:";P["ar-eg"].challengeStartTextTime_challenger="Play the game and set a time.";P["ar-eg"].challengeStartTextScore_challenger="Play the game and set a score.";P["ar-eg"].challengeForfeitConfirmText="You are about to forfeit the challenge. Are you sure you want to proceed?";P["ar-eg"].challengeForfeitConfirmBtn_yes="Yes";P["ar-eg"].challengeForfeitConfirmBtn_no="No";P["ar-eg"].challengeForfeitMessage_success="You have forfeited the challenge.";
P["ar-eg"].challengeForfeitMessage_error="An error occured while forfeiting the challenge. Please try again later.";P["ar-eg"].optionsChallengeForfeit="Forfeit";P["ar-eg"].optionsChallengeCancel="Quit";P["ar-eg"].challengeLoadingError_notValid="Sorry, this challenge is no longer valid.";P["ar-eg"].challengeLoadingError_notStarted="Unable to connect to the server. Please try again later.";P["ar-eg"].levelEndScreenHighScore_time="Best time:";P["ar-eg"].levelEndScreenTotalScore_time="Total time:";
P["ar-eg"]["optionsLang_fr-fr"]="\u0627\u0644\u0641\u0631\u0646\u0633\u064a\u0629";P["ar-eg"]["optionsLang_ko-kr"]="\u0627\u0644\u0643\u0648\u0631\u064a\u0629";P["ar-eg"]["optionsLang_ar-eg"]="\u0627\u0644\u0639\u0631\u0628\u064a\u0629";P["ar-eg"]["optionsLang_es-es"]="\u0627\u0644\u0625\u0633\u0628\u0627\u0646\u064a\u0629";P["ar-eg"]["optionsLang_pt-br"]="\u0627\u0644\u0628\u0631\u0627\u0632\u064a\u0644\u064a\u0629 - \u0627\u0644\u0628\u0631\u062a\u063a\u0627\u0644\u064a\u0629";
P["ar-eg"]["optionsLang_ru-ru"]="\u0627\u0644\u0631\u0648\u0633\u064a\u0629";P["ar-eg"].optionsExit="Exit";P["ar-eg"].levelEndScreenTotalScore_number="Total score:";P["ar-eg"].levelEndScreenHighScore_number="High score:";P["ar-eg"].challengeEndScreenChallengeSend_submessage="<NAME> has 72 hours to accept or decline your challenge. If <NAME> declines or doesn\u2019t accept within 72 hours your wager and challenge fee will be reimbursed.";
P["ar-eg"].challengeEndScreenChallengeSend_submessage_stranger="If no one accepts your challenge within 72 hours, the amount of your wager and the challenge fee will be returned to you.";P["ar-eg"].challengeForfeitMessage_winnings="<NAME> has won <AMOUNT> fairpoints!";P["ar-eg"].optionsAbout_header_publisher="Published by:";P["ar-eg"]["optionsLang_jp-jp"]="Japanese";P["ar-eg"]["optionsLang_it-it"]="Italian";P["ko-kr"]=P["ko-kr"]||{};P["ko-kr"].loadingScreenLoading="\ubd88\ub7ec\uc624\uae30 \uc911...";
P["ko-kr"].startScreenPlay="PLAY";P["ko-kr"].levelMapScreenTotalScore="\ucd1d \uc810\uc218";P["ko-kr"].levelEndScreenTitle_level="\ub808\ubca8 <VALUE>";P["ko-kr"].levelEndScreenTitle_difficulty="\uc798 \ud588\uc5b4\uc694!";P["ko-kr"].levelEndScreenTitle_endless="\uc2a4\ud14c\uc774\uc9c0 <VALUE>";P["ko-kr"].levelEndScreenTotalScore="\ucd1d \uc810\uc218";P["ko-kr"].levelEndScreenSubTitle_levelFailed="\ub808\ubca8 \uc2e4\ud328";P["ko-kr"].levelEndScreenTimeLeft="\ub0a8\uc740 \uc2dc\uac04";
P["ko-kr"].levelEndScreenTimeBonus="\uc2dc\uac04 \ubcf4\ub108\uc2a4";P["ko-kr"].levelEndScreenHighScore="\ucd5c\uace0 \uc810\uc218";P["ko-kr"].optionsStartScreen="\uba54\uc778 \uba54\ub274";P["ko-kr"].optionsQuit="\uc885\ub8cc";P["ko-kr"].optionsResume="\uacc4\uc18d";P["ko-kr"].optionsTutorial="\uac8c\uc784 \ubc29\ubc95";P["ko-kr"].optionsHighScore="\ucd5c\uace0 \uc810\uc218";P["ko-kr"].optionsMoreGames="\ub354 \ub9ce\uc740 \uac8c\uc784";P["ko-kr"].optionsDifficulty_easy="\uac04\ub2e8";
P["ko-kr"].optionsDifficulty_medium="\uc911";P["ko-kr"].optionsDifficulty_hard="\uc0c1";P["ko-kr"].optionsMusic_on="\ucf1c\uae30";P["ko-kr"].optionsMusic_off="\ub044\uae30";P["ko-kr"].optionsSFX_on="\ucf1c\uae30";P["ko-kr"].optionsSFX_off="\ub044\uae30";P["ko-kr"]["optionsLang_en-us"]="\uc601\uc5b4(US)";P["ko-kr"]["optionsLang_en-gb"]="\uc601\uc5b4(GB)";P["ko-kr"]["optionsLang_nl-nl"]="\ub124\ub35c\ub780\ub4dc\uc5b4";P["ko-kr"].gameEndScreenTitle="\ucd95\ud558\ud569\ub2c8\ub2e4!\n\uac8c\uc784\uc744 \uc644\ub8cc\ud588\uc2b5\ub2c8\ub2e4.";
P["ko-kr"].gameEndScreenBtnText="\uacc4\uc18d";P["ko-kr"].optionsTitle="\uc124\uc815";P["ko-kr"].optionsQuitConfirmationText="\uc8fc\uc758!\n\n\uc9c0\uae08 \uc885\ub8cc\ud558\uba74 \uc774 \ub808\ubca8\uc758 \ubaa8\ub4e0 \uc9c4\ud589 \ub0b4\uc6a9\uc744 \uc783\uac8c\ub429\ub2c8\ub2e4. \uc815\ub9d0 \uc885\ub8cc\ud558\uc2dc\uaca0\uc2b5\ub2c8\uae4c?";P["ko-kr"].optionsQuitConfirmBtn_No="\uc544\ub2c8\uc624";P["ko-kr"].optionsQuitConfirmBtn_Yes="\ub124, \ud655\uc2e4\ud569\ub2c8\ub2e4";
P["ko-kr"].levelMapScreenTitle="\ub808\ubca8 \uc120\ud0dd";P["ko-kr"].optionsRestartConfirmationText="\uc8fc\uc758!\n\n\uc9c0\uae08 \ub2e4\uc2dc \uc2dc\uc791\ud558\uba74 \uc774 \ub808\ubca8\uc758 \ubaa8\ub4e0 \uc9c4\ud589 \ub0b4\uc6a9\uc744 \uc783\uac8c\ub429\ub2c8\ub2e4. \uc815\ub9d0 \ub2e4\uc2dc \uc2dc\uc791\ud558\uc2dc\uaca0\uc2b5\ub2c8\uae4c?";P["ko-kr"].optionsRestart="\ub2e4\uc2dc \uc2dc\uc791";P["ko-kr"].optionsSFXBig_on="\uc74c\ud5a5 \ucf1c\uae30";P["ko-kr"].optionsSFXBig_off="\uc74c\ud5a5 \ub044\uae30";
P["ko-kr"].optionsAbout_title="\uad00\ub828 \uc815\ubcf4";P["ko-kr"].optionsAbout_text="CharmTeam\nlocalplayer.club \n\u00a9 2020";P["ko-kr"].optionsAbout_backBtn="\ub4a4\ub85c";P["ko-kr"].optionsAbout_version="\ubc84\uc804:";P["ko-kr"].optionsAbout="\uad00\ub828 \uc815\ubcf4";P["ko-kr"].levelEndScreenMedal="\ud5a5\uc0c1\ud588\uad70\uc694!";P["ko-kr"].startScreenQuestionaire="\uc5b4\ub5bb\uac8c \uc0dd\uac01\ud558\uc138\uc694?";P["ko-kr"].levelMapScreenWorld_0="\ub808\ubca8 \uc120\ud0dd";
P["ko-kr"].startScreenByCharmStudio="\uc81c\uc791: CharmTeam";P["ko-kr"]["optionsLang_de-de"]="\ub3c5\uc77c\uc5b4";P["ko-kr"]["optionsLang_tr-tr"]="\ud130\ud0a4\uc5b4";P["ko-kr"].optionsAbout_header="Developed by:";P["ko-kr"].levelEndScreenViewHighscoreBtn="View scores";P["ko-kr"].levelEndScreenSubmitHighscoreBtn="Submit score";P["ko-kr"].challengeStartScreenTitle_challengee_friend="You have been challenged by:";P["ko-kr"].challengeStartTextScore="<NAME>'s score:";
P["ko-kr"].challengeStartTextTime="<NAME>'s time:";P["ko-kr"].challengeStartScreenToWin="Amount to win:";P["ko-kr"].challengeEndScreenWinnings="You have won <AMOUNT> fairpoints";P["ko-kr"].challengeEndScreenOutcomeMessage_WON="You have won the challenge!";P["ko-kr"].challengeEndScreenOutcomeMessage_LOST="You have lost the challenge.";P["ko-kr"].challengeEndScreenOutcomeMessage_TIED="You tied.";P["ko-kr"].challengeCancelConfirmText="You are about to cancel the challenge. Your wager will be returned minus the challenge fee. Are you sure you want to cancel the challenge?";
P["ko-kr"].challengeCancelConfirmBtn_yes="Yes";P["ko-kr"].challengeCancelConfirmBtn_no="No";P["ko-kr"].challengeEndScreensBtn_submit="Submit challenge";P["ko-kr"].challengeEndScreenBtn_cancel="Cancel challenge";P["ko-kr"].challengeEndScreenName_you="You";P["ko-kr"].challengeEndScreenChallengeSend_error="An error occured while submitting the challenge. Please try again later.";P["ko-kr"].challengeEndScreenChallengeSend_success="Your challenge has been sent!";
P["ko-kr"].challengeCancelMessage_error="An error occured while cancelling your challenge. Please try again later.";P["ko-kr"].challengeCancelMessage_success="Your challenge has been cancelled.";P["ko-kr"].challengeEndScreenScoreSend_error="An error occured while communicating with the server. Please try again later.";P["ko-kr"].challengeStartScreenTitle_challengee_stranger="You have been matched with:";P["ko-kr"].challengeStartScreenTitle_challenger_friend="You are challenging:";
P["ko-kr"].challengeStartScreenTitle_challenger_stranger="You are setting a score for:";P["ko-kr"].challengeStartTextTime_challenger="Play the game and set a time.";P["ko-kr"].challengeStartTextScore_challenger="Play the game and set a score.";P["ko-kr"].challengeForfeitConfirmText="You are about to forfeit the challenge. Are you sure you want to proceed?";P["ko-kr"].challengeForfeitConfirmBtn_yes="Yes";P["ko-kr"].challengeForfeitConfirmBtn_no="No";P["ko-kr"].challengeForfeitMessage_success="You have forfeited the challenge.";
P["ko-kr"].challengeForfeitMessage_error="An error occured while forfeiting the challenge. Please try again later.";P["ko-kr"].optionsChallengeForfeit="Forfeit";P["ko-kr"].optionsChallengeCancel="Quit";P["ko-kr"].challengeLoadingError_notValid="Sorry, this challenge is no longer valid.";P["ko-kr"].challengeLoadingError_notStarted="Unable to connect to the server. Please try again later.";P["ko-kr"].levelEndScreenHighScore_time="Best time:";P["ko-kr"].levelEndScreenTotalScore_time="Total time:";
P["ko-kr"]["optionsLang_fr-fr"]="\ud504\ub791\uc2a4\uc5b4";P["ko-kr"]["optionsLang_ko-kr"]="\ud55c\uad6d\uc5b4";P["ko-kr"]["optionsLang_ar-eg"]="\uc544\ub77c\ube44\uc544\uc5b4";P["ko-kr"]["optionsLang_es-es"]="\uc2a4\ud398\uc778\uc5b4";P["ko-kr"]["optionsLang_pt-br"]="\ud3ec\ub974\ud22c\uac08\uc5b4(\ube0c\ub77c\uc9c8)";P["ko-kr"]["optionsLang_ru-ru"]="\ub7ec\uc2dc\uc544\uc5b4";P["ko-kr"].optionsExit="Exit";P["ko-kr"].levelEndScreenTotalScore_number="Total score:";
P["ko-kr"].levelEndScreenHighScore_number="High score:";P["ko-kr"].challengeEndScreenChallengeSend_submessage="<NAME> has 72 hours to accept or decline your challenge. If <NAME> declines or doesn\u2019t accept within 72 hours your wager and challenge fee will be reimbursed.";P["ko-kr"].challengeEndScreenChallengeSend_submessage_stranger="If no one accepts your challenge within 72 hours, the amount of your wager and the challenge fee will be returned to you.";
P["ko-kr"].challengeForfeitMessage_winnings="<NAME> has won <AMOUNT> fairpoints!";P["ko-kr"].optionsAbout_header_publisher="Published by:";P["ko-kr"]["optionsLang_jp-jp"]="Japanese";P["ko-kr"]["optionsLang_it-it"]="Italian";P["jp-jp"]=P["jp-jp"]||{};P["jp-jp"].loadingScreenLoading="\u30ed\u30fc\u30c9\u4e2d\u2026";P["jp-jp"].startScreenPlay="\u30d7\u30ec\u30a4";P["jp-jp"].levelMapScreenTotalScore="\u30c8\u30fc\u30bf\u30eb\u30b9\u30b3\u30a2";P["jp-jp"].levelEndScreenTitle_level="\u30ec\u30d9\u30eb <VALUE>";
P["jp-jp"].levelEndScreenTitle_difficulty="\u3084\u3063\u305f\u306d\uff01";P["jp-jp"].levelEndScreenTitle_endless="\u30b9\u30c6\u30fc\u30b8 <VALUE>";P["jp-jp"].levelEndScreenTotalScore="\u30c8\u30fc\u30bf\u30eb\u30b9\u30b3\u30a2";P["jp-jp"].levelEndScreenSubTitle_levelFailed="\u30b2\u30fc\u30e0\u30aa\u30fc\u30d0\u30fc";P["jp-jp"].levelEndScreenTimeLeft="\u6b8b\u308a\u6642\u9593";P["jp-jp"].levelEndScreenTimeBonus="\u30bf\u30a4\u30e0\u30dc\u30fc\u30ca\u30b9";P["jp-jp"].levelEndScreenHighScore="\u30cf\u30a4\u30b9\u30b3\u30a2";
P["jp-jp"].optionsStartScreen="\u30e1\u30a4\u30f3\u30e1\u30cb\u30e5\u30fc";P["jp-jp"].optionsQuit="\u3084\u3081\u308b";P["jp-jp"].optionsResume="\u518d\u958b";P["jp-jp"].optionsTutorial="\u3042\u305d\u3073\u65b9";P["jp-jp"].optionsHighScore="\u30cf\u30a4\u30b9\u30b3\u30a2";P["jp-jp"].optionsMoreGames="\u4ed6\u306e\u30b2\u30fc\u30e0";P["jp-jp"].optionsDifficulty_easy="\u304b\u3093\u305f\u3093";P["jp-jp"].optionsDifficulty_medium="\u3075\u3064\u3046";P["jp-jp"].optionsDifficulty_hard="\u96e3\u3057\u3044";
P["jp-jp"].optionsMusic_on="\u30aa\u30f3";P["jp-jp"].optionsMusic_off="\u30aa\u30d5";P["jp-jp"].optionsSFX_on="\u30aa\u30f3";P["jp-jp"].optionsSFX_off="\u30aa\u30d5";P["jp-jp"]["optionsLang_en-us"]="\u82f1\u8a9e\uff08\u7c73\u56fd\uff09";P["jp-jp"]["optionsLang_en-gb"]="\u82f1\u8a9e\uff08\u82f1\u56fd\uff09";P["jp-jp"]["optionsLang_nl-nl"]="\u30aa\u30e9\u30f3\u30c0\u8a9e";P["jp-jp"].gameEndScreenTitle="\u304a\u3081\u3067\u3068\u3046\uff01\n\u3059\u3079\u3066\u306e\u30ec\u30d9\u30eb\u3092\u30af\u30ea\u30a2\u3057\u307e\u3057\u305f\u3002";
P["jp-jp"].gameEndScreenBtnText="\u7d9a\u3051\u308b";P["jp-jp"].optionsTitle="\u8a2d\u5b9a";P["jp-jp"].optionsQuitConfirmationText="\u6ce8\u610f\uff01\n\n\u3053\u3053\u3067\u3084\u3081\u308b\u3068\n\u8a18\u9332\u304c\u30ea\u30bb\u30c3\u30c8\u3055\u308c\u307e\u3059\u304c\n\u3088\u308d\u3057\u3044\u3067\u3059\u304b\uff1f";P["jp-jp"].optionsQuitConfirmBtn_No="\u3044\u3044\u3048\u3001\u7d9a\u3051\u307e\u3059\u3002";P["jp-jp"].optionsQuitConfirmBtn_Yes="\u306f\u3044\u3001\u3084\u3081\u307e\u3059\u3002";
P["jp-jp"].levelMapScreenTitle="\u30ec\u30d9\u30eb\u9078\u629e";P["jp-jp"].optionsRestartConfirmationText="\u6ce8\u610f\uff01\n\n\u3053\u3053\u3067\u518d\u30b9\u30bf\u30fc\u30c8\u3059\u308b\u3068\n\u8a18\u9332\u304c\u30ea\u30bb\u30c3\u30c8\u3055\u308c\u307e\u3059\u304c\n\u3088\u308d\u3057\u3044\u3067\u3059\u304b\uff1f";P["jp-jp"].optionsRestart="\u518d\u30b9\u30bf\u30fc\u30c8";P["jp-jp"].optionsSFXBig_on="\u30b5\u30a6\u30f3\u30c9 \u30aa\u30f3";P["jp-jp"].optionsSFXBig_off="\u30b5\u30a6\u30f3\u30c9 \u30aa\u30d5";
P["jp-jp"].optionsAbout_title="About";P["jp-jp"].optionsAbout_text="CharmTeam\nlocalplayer.club \n\u00a9 2020";P["jp-jp"].optionsAbout_backBtn="\u3082\u3069\u308b";P["jp-jp"].optionsAbout_version="version";P["jp-jp"].optionsAbout="About";P["jp-jp"].levelEndScreenMedal="\u8a18\u9332\u66f4\u65b0\uff01";P["jp-jp"].startScreenQuestionaire="\u3053\u306e\u30b2\u30fc\u30e0\u3078\u306e\u611f\u60f3";P["jp-jp"].levelMapScreenWorld_0="\u30ec\u30d9\u30eb\u9078\u629e";P["jp-jp"].startScreenByCharmStudio="by: CharmTeam";
P["jp-jp"]["optionsLang_de-de"]="\u30c9\u30a4\u30c4\u8a9e";P["jp-jp"]["optionsLang_tr-tr"]="\u30c8\u30eb\u30b3\u8a9e";P["jp-jp"].optionsAbout_header="Developed by";P["jp-jp"].levelEndScreenViewHighscoreBtn="\u30b9\u30b3\u30a2\u3092\u307f\u308b";P["jp-jp"].levelEndScreenSubmitHighscoreBtn="\u30b9\u30b3\u30a2\u9001\u4fe1";P["jp-jp"].challengeStartScreenTitle_challengee_friend="\u304b\u3089\u6311\u6226\u3092\u53d7\u3051\u307e\u3057\u305f";P["jp-jp"].challengeStartTextScore="<NAME>\u306e\u30b9\u30b3\u30a2";
P["jp-jp"].challengeStartTextTime="<NAME>\u306e\u6642\u9593";P["jp-jp"].challengeStartScreenToWin="\u30dd\u30a4\u30f3\u30c8\u6570";P["jp-jp"].challengeEndScreenWinnings="<AMOUNT>\u30dd\u30a4\u30f3\u30c8\u7372\u5f97";P["jp-jp"].challengeEndScreenOutcomeMessage_WON="You have won the challenge!";P["jp-jp"].challengeEndScreenOutcomeMessage_LOST="You have lost the challenge.";P["jp-jp"].challengeEndScreenOutcomeMessage_TIED="\u540c\u70b9";P["jp-jp"].challengeCancelConfirmText="You are about to cancel the challenge. Your wager will be returned minus the challenge fee. Are you sure you want to cancel the challenge?";
P["jp-jp"].challengeCancelConfirmBtn_yes="Yes";P["jp-jp"].challengeCancelConfirmBtn_no="No";P["jp-jp"].challengeEndScreensBtn_submit="\u3042";P["jp-jp"].challengeEndScreenBtn_cancel="Cancel challenge";P["jp-jp"].challengeEndScreenName_you="You";P["jp-jp"].challengeEndScreenChallengeSend_error="An error occured while submitting the challenge. Please try again later.";P["jp-jp"].challengeEndScreenChallengeSend_success="Your challenge has been sent!";P["jp-jp"].challengeCancelMessage_error="An error occured while cancelling your challenge. Please try again later.";
P["jp-jp"].challengeCancelMessage_success="Your challenge has been cancelled.";P["jp-jp"].challengeEndScreenScoreSend_error="An error occured while communicating with the server. Please try again later.";P["jp-jp"].challengeStartScreenTitle_challengee_stranger="You have been matched with:";P["jp-jp"].challengeStartScreenTitle_challenger_friend="You are challenging:";P["jp-jp"].challengeStartScreenTitle_challenger_stranger="You are setting a score for:";
P["jp-jp"].challengeStartTextTime_challenger="Play the game and set a time.";P["jp-jp"].challengeStartTextScore_challenger="Play the game and set a score.";P["jp-jp"].challengeForfeitConfirmText="You are about to forfeit the challenge. Are you sure you want to proceed?";P["jp-jp"].challengeForfeitConfirmBtn_yes="Yes";P["jp-jp"].challengeForfeitConfirmBtn_no="No";P["jp-jp"].challengeForfeitMessage_success="You have forfeited the challenge.";P["jp-jp"].challengeForfeitMessage_error="An error occured while forfeiting the challenge. Please try again later.";
P["jp-jp"].optionsChallengeForfeit="Forfeit";P["jp-jp"].optionsChallengeCancel="Quit";P["jp-jp"].challengeLoadingError_notValid="Sorry, this challenge is no longer valid.";P["jp-jp"].challengeLoadingError_notStarted="Unable to connect to the server. Please try again later.";P["jp-jp"].levelEndScreenHighScore_time="Best time:";P["jp-jp"].levelEndScreenTotalScore_time="Total time:";P["jp-jp"]["optionsLang_fr-fr"]="French";P["jp-jp"]["optionsLang_ko-kr"]="Korean";P["jp-jp"]["optionsLang_ar-eg"]="Arabic";
P["jp-jp"]["optionsLang_es-es"]="Spanish";P["jp-jp"]["optionsLang_pt-br"]="Brazilian-Portuguese";P["jp-jp"]["optionsLang_ru-ru"]="Russian";P["jp-jp"].optionsExit="Exit";P["jp-jp"].levelEndScreenTotalScore_number="\u30c8\u30fc\u30bf\u30eb\u30b9\u30b3\u30a2:";P["jp-jp"].levelEndScreenHighScore_number="\u30cf\u30a4\u30b9\u30b3\u30a2:";P["jp-jp"].challengeEndScreenChallengeSend_submessage="<NAME> has 72 hours to accept or decline your challenge. If <NAME> declines or doesn\u2019t accept within 72 hours your wager and challenge fee will be reimbursed.";
P["jp-jp"].challengeEndScreenChallengeSend_submessage_stranger="If no one accepts your challenge within 72 hours, the amount of your wager and the challenge fee will be returned to you.";P["jp-jp"].challengeForfeitMessage_winnings="<NAME> has won <AMOUNT> fairpoints!";P["jp-jp"].optionsAbout_header_publisher="Published by:";P["jp-jp"]["optionsLang_jp-jp"]="\u65e5\u672c\u8a9e";P["jp-jp"]["optionsLang_it-it"]="Italian";P["it-it"]=P["it-it"]||{};P["it-it"].loadingScreenLoading="Caricamento...";
P["it-it"].startScreenPlay="GIOCA";P["it-it"].levelMapScreenTotalScore="Punteggio totale";P["it-it"].levelEndScreenTitle_level="Livello <VALUE>";P["it-it"].levelEndScreenTitle_difficulty="Ottimo lavoro!";P["it-it"].levelEndScreenTitle_endless="Livello <VALUE>";P["it-it"].levelEndScreenTotalScore="Punteggio totale";P["it-it"].levelEndScreenSubTitle_levelFailed="Non hai superato il livello";P["it-it"].levelEndScreenTimeLeft="Tempo rimanente";P["it-it"].levelEndScreenTimeBonus="Tempo bonus";
P["it-it"].levelEndScreenHighScore="Record";P["it-it"].optionsStartScreen="Menu principale";P["it-it"].optionsQuit="Esci";P["it-it"].optionsResume="Riprendi";P["it-it"].optionsTutorial="Come si gioca";P["it-it"].optionsHighScore="Record";P["it-it"].optionsMoreGames="Altri giochi";P["it-it"].optionsDifficulty_easy="Facile";P["it-it"].optionsDifficulty_medium="Media";P["it-it"].optionsDifficulty_hard="Difficile";P["it-it"].optionsMusic_on="S\u00ec";P["it-it"].optionsMusic_off="No";
P["it-it"].optionsSFX_on="S\u00ec";P["it-it"].optionsSFX_off="No";P["it-it"]["optionsLang_en-us"]="Inglese (US)";P["it-it"]["optionsLang_en-gb"]="Inglese (UK)";P["it-it"]["optionsLang_nl-nl"]="Olandese";P["it-it"].gameEndScreenTitle="Congratulazioni!\nHai completato il gioco.";P["it-it"].gameEndScreenBtnText="Continua";P["it-it"].optionsTitle="Impostazioni";P["it-it"].optionsQuitConfirmationText="Attenzione!\n\nSe abbandoni ora, perderai tutti i progressi ottenuti in questo livello. Confermi?";
P["it-it"].optionsQuitConfirmBtn_No="No";P["it-it"].optionsQuitConfirmBtn_Yes="S\u00ec, ho deciso";P["it-it"].levelMapScreenTitle="Scegli un livello";P["it-it"].optionsRestartConfirmationText="Attenzione!\n\nSe riavvii ora, perderai tutti i progressi ottenuti in questo livello. Confermi?";P["it-it"].optionsRestart="Riavvia";P["it-it"].optionsSFXBig_on="Audio S\u00cc";P["it-it"].optionsSFXBig_off="Audio NO";P["it-it"].optionsAbout_title="Informazioni";P["it-it"].optionsAbout_text="CharmTeam\nlocalplayer.club \n\u00a9 2020";
P["it-it"].optionsAbout_backBtn="Indietro";P["it-it"].optionsAbout_version="versione:";P["it-it"].optionsAbout="Informazioni";P["it-it"].levelEndScreenMedal="MIGLIORATO!";P["it-it"].startScreenQuestionaire="Che ne pensi?";P["it-it"].levelMapScreenWorld_0="Scegli un livello";P["it-it"].startScreenByCharmStudio="di: CharmTeam";P["it-it"]["optionsLang_de-de"]="Tedesco";P["it-it"]["optionsLang_tr-tr"]="Turco";P["it-it"].optionsAbout_header="Sviluppato da:";P["it-it"].levelEndScreenViewHighscoreBtn="Guarda i punteggi";
P["it-it"].levelEndScreenSubmitHighscoreBtn="Invia il punteggio";P["it-it"].challengeStartScreenTitle_challengee_friend="Hai ricevuto una sfida da:";P["it-it"].challengeStartTextScore="punteggio di <NAME>:";P["it-it"].challengeStartTextTime="tempo di <NAME>:";P["it-it"].challengeStartScreenToWin="Necessario per vincere:";P["it-it"].challengeEndScreenWinnings="Hai vinto <AMOUNT> fairpoint";P["it-it"].challengeEndScreenOutcomeMessage_WON="Hai vinto la sfida!";
P["it-it"].challengeEndScreenOutcomeMessage_LOST="Hai perso la sfida.";P["it-it"].challengeEndScreenOutcomeMessage_TIED="Hai pareggiato.";P["it-it"].challengeCancelConfirmText="Stai per annullare la sfida. Recupererai la posta, tranne la quota di partecipazione alla sfida. Confermi?";P["it-it"].challengeCancelConfirmBtn_yes="S\u00ec";P["it-it"].challengeCancelConfirmBtn_no="No";P["it-it"].challengeEndScreensBtn_submit="Invia la sfida";P["it-it"].challengeEndScreenBtn_cancel="Annulla la sfida";
P["it-it"].challengeEndScreenName_you="Tu";P["it-it"].challengeEndScreenChallengeSend_error="Impossibile inviare la sfida. Riprova pi\u00f9 tardi.";P["it-it"].challengeEndScreenChallengeSend_success="Sfida inviata!";P["it-it"].challengeCancelMessage_error="Impossibile annullare la sfida. Riprova pi\u00f9 tardi.";P["it-it"].challengeCancelMessage_success="Sfida annullata.";P["it-it"].challengeEndScreenScoreSend_error="Impossibile comunicare col server. Riprova pi\u00f9 tardi.";
P["it-it"].challengeStartScreenTitle_challengee_stranger="Sei stato abbinato a:";P["it-it"].challengeStartScreenTitle_challenger_friend="Stai sfidando:";P["it-it"].challengeStartScreenTitle_challenger_stranger="Stai impostando un punteggio da battere per:";P["it-it"].challengeStartTextTime_challenger="Gioca e imposta un tempo da battere.";P["it-it"].challengeStartTextScore_challenger="Gioca e imposta un punteggio da superare.";P["it-it"].challengeForfeitConfirmText="Stai per abbandonare la sfida. Confermi?";
P["it-it"].challengeForfeitConfirmBtn_yes="S\u00ec";P["it-it"].challengeForfeitConfirmBtn_no="No";P["it-it"].challengeForfeitMessage_success="Hai abbandonato la sfida.";P["it-it"].challengeForfeitMessage_error="Impossibile abbandonare la sfida. Riprova pi\u00f9 tardi.";P["it-it"].optionsChallengeForfeit="Abbandona";P["it-it"].optionsChallengeCancel="Esci";P["it-it"].challengeLoadingError_notValid="La sfida non \u00e8 pi\u00f9 valida.";P["it-it"].challengeLoadingError_notStarted="Impossibile connettersi al server. Riprova pi\u00f9 tardi.";
P["it-it"].levelEndScreenHighScore_time="Miglior tempo:";P["it-it"].levelEndScreenTotalScore_time="Tempo totale:";P["it-it"]["optionsLang_fr-fr"]="Francese";P["it-it"]["optionsLang_ko-kr"]="Coreano";P["it-it"]["optionsLang_ar-eg"]="Arabo";P["it-it"]["optionsLang_es-es"]="Spagnolo";P["it-it"]["optionsLang_pt-br"]="Brasiliano - Portoghese";P["it-it"]["optionsLang_ru-ru"]="Russo";P["it-it"].optionsExit="Esci";P["it-it"].levelEndScreenTotalScore_number="Punteggio totale:";
P["it-it"].levelEndScreenHighScore_number="Record:";P["it-it"].challengeEndScreenChallengeSend_submessage="<NAME> ha a disposizione 72 ore per accettare o rifiutare la tua sfida. Se la rifiuta, o non la accetta entro 72 ore, recupererai la posta e la quota di partecipazione alla sfida.";P["it-it"].challengeEndScreenChallengeSend_submessage_stranger="Se nessuno accetta la tua sfida entro 72 ore, recuperi la posta e la quota di partecipazione alla sfida.";
P["it-it"].challengeForfeitMessage_winnings="<NAME> ha vinto <AMOUNT> fairpoint!";P["it-it"].optionsAbout_header_publisher="Distribuito da:";P["it-it"]["optionsLang_jp-jp"]="Giapponese";P["it-it"]["optionsLang_it-it"]="Italiano";P=P||{};P["nl-nl"]=P["nl-nl"]||{};P["nl-nl"].game_ui_SCORE="SCORE";P["nl-nl"].game_ui_STAGE="LEVEL";P["nl-nl"].game_ui_LIVES="LEVENS";P["nl-nl"].game_ui_TIME="TIJD";P["nl-nl"].game_ui_HIGHSCORE="HIGH SCORE";P["nl-nl"].game_ui_LEVEL="LEVEL";P["nl-nl"].game_ui_time_left="Resterende tijd";
P["nl-nl"].game_ui_TIME_TO_BEAT="DOELTIJD";P["nl-nl"].game_ui_SCORE_TO_BEAT="DOELSCORE";P["nl-nl"].game_ui_HIGHSCORE_break="HIGH\nSCORE";P["en-us"]=P["en-us"]||{};P["en-us"].game_ui_SCORE="SCORE";P["en-us"].game_ui_STAGE="STAGE";P["en-us"].game_ui_LIVES="LIVES";P["en-us"].game_ui_TIME="TIME";P["en-us"].game_ui_HIGHSCORE="HIGH SCORE";P["en-us"].game_ui_LEVEL="LEVEL";P["en-us"].game_ui_time_left="Time left";P["en-us"].game_ui_TIME_TO_BEAT="TIME TO BEAT";P["en-us"].game_ui_SCORE_TO_BEAT="SCORE TO BEAT";
P["en-us"].game_ui_HIGHSCORE_break="HIGH\nSCORE";P["en-gb"]=P["en-gb"]||{};P["en-gb"].game_ui_SCORE="SCORE";P["en-gb"].game_ui_STAGE="STAGE";P["en-gb"].game_ui_LIVES="LIVES";P["en-gb"].game_ui_TIME="TIME";P["en-gb"].game_ui_HIGHSCORE="HIGH SCORE";P["en-gb"].game_ui_LEVEL="LEVEL";P["en-gb"].game_ui_time_left="Time left";P["en-gb"].game_ui_TIME_TO_BEAT="TIME TO BEAT";P["en-gb"].game_ui_SCORE_TO_BEAT="SCORE TO BEAT";P["en-gb"].game_ui_HIGHSCORE_break="HIGH\nSCORE";P["de-de"]=P["de-de"]||{};
P["de-de"].game_ui_SCORE="PUNKTE";P["de-de"].game_ui_STAGE="STUFE";P["de-de"].game_ui_LIVES="LEBEN";P["de-de"].game_ui_TIME="ZEIT";P["de-de"].game_ui_HIGHSCORE="HIGHSCORE";P["de-de"].game_ui_LEVEL="LEVEL";P["de-de"].game_ui_time_left="Restzeit";P["de-de"].game_ui_TIME_TO_BEAT="ZEITVORGABE";P["de-de"].game_ui_SCORE_TO_BEAT="Zu schlagende Punktzahl";P["de-de"].game_ui_HIGHSCORE_break="HIGHSCORE";P["fr-fr"]=P["fr-fr"]||{};P["fr-fr"].game_ui_SCORE="SCORE";P["fr-fr"].game_ui_STAGE="SC\u00c8NE";
P["fr-fr"].game_ui_LIVES="VIES";P["fr-fr"].game_ui_TIME="TEMPS";P["fr-fr"].game_ui_HIGHSCORE="MEILLEUR SCORE";P["fr-fr"].game_ui_LEVEL="NIVEAU";P["fr-fr"].game_ui_time_left="Temps restant";P["fr-fr"].game_ui_TIME_TO_BEAT="TEMPS \u00c0 BATTRE";P["fr-fr"].game_ui_SCORE_TO_BEAT="SCORE \u00c0 BATTRE";P["fr-fr"].game_ui_HIGHSCORE_break="MEILLEUR\nSCORE";P["pt-br"]=P["pt-br"]||{};P["pt-br"].game_ui_SCORE="PONTOS";P["pt-br"].game_ui_STAGE="FASE";P["pt-br"].game_ui_LIVES="VIDAS";P["pt-br"].game_ui_TIME="TEMPO";
P["pt-br"].game_ui_HIGHSCORE="RECORDE";P["pt-br"].game_ui_LEVEL="N\u00cdVEL";P["pt-br"].game_ui_time_left="Tempo restante";P["pt-br"].game_ui_TIME_TO_BEAT="HORA DE ARRASAR";P["pt-br"].game_ui_SCORE_TO_BEAT="RECORDE A SER SUPERADO";P["pt-br"].game_ui_HIGHSCORE_break="RECORDE";P["es-es"]=P["es-es"]||{};P["es-es"].game_ui_SCORE="PUNTOS";P["es-es"].game_ui_STAGE="FASE";P["es-es"].game_ui_LIVES="VIDAS";P["es-es"].game_ui_TIME="TIEMPO";P["es-es"].game_ui_HIGHSCORE="R\u00c9CORD";
P["es-es"].game_ui_LEVEL="NIVEL";P["es-es"].game_ui_time_left="Tiempo restante";P["es-es"].game_ui_TIME_TO_BEAT="TIEMPO OBJETIVO";P["es-es"].game_ui_SCORE_TO_BEAT="PUNTUACI\u00d3N OBJETIVO";P["es-es"].game_ui_HIGHSCORE_break="R\u00c9CORD";P["tr-tr"]=P["tr-tr"]||{};P["tr-tr"].game_ui_SCORE="SKOR";P["tr-tr"].game_ui_STAGE="B\u00d6L\u00dcM";P["tr-tr"].game_ui_LIVES="HAYATLAR";P["tr-tr"].game_ui_TIME="S\u00dcRE";P["tr-tr"].game_ui_HIGHSCORE="Y\u00dcKSEK SKOR";P["tr-tr"].game_ui_LEVEL="SEV\u0130YE";
P["tr-tr"].game_ui_time_left="Kalan zaman";P["tr-tr"].game_ui_TIME_TO_BEAT="B\u0130T\u0130RME ZAMANI";P["tr-tr"].game_ui_SCORE_TO_BEAT="B\u0130T\u0130RME PUANI";P["tr-tr"].game_ui_HIGHSCORE_break="Y\u00dcKSEK\nSKOR";P["ru-ru"]=P["ru-ru"]||{};P["ru-ru"].game_ui_SCORE="\u0420\u0415\u0417\u0423\u041b\u042c\u0422\u0410\u0422";P["ru-ru"].game_ui_STAGE="\u042d\u0422\u0410\u041f";P["ru-ru"].game_ui_LIVES="\u0416\u0418\u0417\u041d\u0418";P["ru-ru"].game_ui_TIME="\u0412\u0420\u0415\u041c\u042f";
P["ru-ru"].game_ui_HIGHSCORE="\u0420\u0415\u041a\u041e\u0420\u0414";P["ru-ru"].game_ui_LEVEL="\u0423\u0420\u041e\u0412\u0415\u041d\u042c";P["ru-ru"].game_ui_time_left="Time left";P["ru-ru"].game_ui_TIME_TO_BEAT="TIME TO BEAT";P["ru-ru"].game_ui_SCORE_TO_BEAT="SCORE TO BEAT";P["ru-ru"].game_ui_HIGHSCORE_break="\u0420\u0415\u041a\u041e\u0420\u0414";P["ar-eg"]=P["ar-eg"]||{};P["ar-eg"].game_ui_SCORE="\u0627\u0644\u0646\u062a\u064a\u062c\u0629";P["ar-eg"].game_ui_STAGE="\u0645\u0631\u062d\u0644\u0629";
P["ar-eg"].game_ui_LIVES="\u0639\u062f\u062f \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0627\u062a";P["ar-eg"].game_ui_TIME="\u0627\u0644\u0648\u0642\u062a";P["ar-eg"].game_ui_HIGHSCORE="\u0623\u0639\u0644\u0649 \u0646\u062a\u064a\u062c\u0629";P["ar-eg"].game_ui_LEVEL="\u0645\u0633\u062a\u0648\u0649";P["ar-eg"].game_ui_time_left="Time left";P["ar-eg"].game_ui_TIME_TO_BEAT="TIME TO BEAT";P["ar-eg"].game_ui_SCORE_TO_BEAT="SCORE TO BEAT";P["ar-eg"].game_ui_HIGHSCORE_break="\u0623\u0639\u0644\u0649 \u0646\u062a\u064a\u062c\u0629";
P["ko-kr"]=P["ko-kr"]||{};P["ko-kr"].game_ui_SCORE="\uc810\uc218";P["ko-kr"].game_ui_STAGE="\uc2a4\ud14c\uc774\uc9c0";P["ko-kr"].game_ui_LIVES="\uae30\ud68c";P["ko-kr"].game_ui_TIME="\uc2dc\uac04";P["ko-kr"].game_ui_HIGHSCORE="\ucd5c\uace0 \uc810\uc218";P["ko-kr"].game_ui_LEVEL="\ub808\ubca8";P["ko-kr"].game_ui_time_left="Time left";P["ko-kr"].game_ui_TIME_TO_BEAT="TIME TO BEAT";P["ko-kr"].game_ui_SCORE_TO_BEAT="SCORE TO BEAT";P["ko-kr"].game_ui_HIGHSCORE_break="\ucd5c\uace0 \uc810\uc218";
P["jp-jp"]=P["jp-jp"]||{};P["jp-jp"].game_ui_SCORE="\u30b9\u30b3\u30a2";P["jp-jp"].game_ui_STAGE="\u30b9\u30c6\u30fc\u30b8";P["jp-jp"].game_ui_LIVES="\u30e9\u30a4\u30d5";P["jp-jp"].game_ui_TIME="\u30bf\u30a4\u30e0";P["jp-jp"].game_ui_HIGHSCORE="\u30cf\u30a4\u30b9\u30b3\u30a2";P["jp-jp"].game_ui_LEVEL="\u30ec\u30d9\u30eb";P["jp-jp"].game_ui_time_left="\u6b8b\u308a\u6642\u9593";P["jp-jp"].game_ui_TIME_TO_BEAT="\u30af\u30ea\u30a2\u307e\u3067\u3042\u3068";P["jp-jp"].game_ui_SCORE_TO_BEAT="\u30af\u30ea\u30a2\u307e\u3067\u3042\u3068";
P["jp-jp"].game_ui_HIGHSCORE_break="\u30cf\u30a4\n\u30b9\u30b3\u30a2";P["it-it"]=P["it-it"]||{};P["it-it"].game_ui_SCORE="PUNTEGGIO";P["it-it"].game_ui_STAGE="FASE";P["it-it"].game_ui_LIVES="VITE";P["it-it"].game_ui_TIME="TEMPO";P["it-it"].game_ui_HIGHSCORE="RECORD";P["it-it"].game_ui_LEVEL="LIVELLO";P["it-it"].game_ui_time_left="TEMPO RIMANENTE";P["it-it"].game_ui_TIME_TO_BEAT="TEMPO DA BATTERE";P["it-it"].game_ui_SCORE_TO_BEAT="PUNTEGGIO DA BATTERE";P["it-it"].game_ui_HIGHSCORE_break="RECORD";
var Vf={};
function Wf(){Vf={He:{gl:"en-us",kk:"en-us en-gb nl-nl de-de fr-fr pt-br es-es tr-tr ru-ru ar-eg ko-kr jp-jp it-it".split(" ")},Rd:{cd:N(1040),Xq:N(960),nc:N(640),nh:N(640),eg:N(0),wl:N(-80),dg:0,minHeight:N(780),mn:{id:"canvasBackground",depth:50},Zc:{id:"canvasGame",depth:100,top:N(200,"round"),left:N(40,"round"),width:N(560,"round"),height:N(560,"round")},$c:{id:"canvasGameUI",depth:150,top:0,left:0,height:N(120,"round")},$f:{id:"canvasMain",depth:200}},nn:{cd:N(640),Xq:N(640),nc:N(1152),nh:N(1152),
eg:N(0),wl:N(0),dg:0,minHeight:N(640),minWidth:N(850),mn:{id:"canvasBackground",depth:50},Zc:{id:"canvasGame",depth:100,top:N(40,"round"),left:N(296,"round"),width:N(560,"round"),height:N(560,"round")},$c:{id:"canvasGameUI",depth:150,top:0,left:N(151),width:N(140)},$f:{id:"canvasMain",depth:200}},mc:{bigPlay:{type:"text",q:oe,Da:N(38),Bb:N(99),font:{align:"center",i:"middle",fontSize:O({big:46,small:30}),fillColor:"#01198a",O:{h:!0,color:"#7bfdff",offsetX:0,offsetY:2,blur:0}},qd:2,rd:N(30),fontSize:O({big:46,
small:30})},difficulty_toggle:{type:"toggleText",q:ie,Da:N(106),Bb:N(40),font:{align:"center",i:"middle",fontSize:O({big:40,small:20}),fillColor:"#018a17",O:{h:!0,color:"#d2ff7b",offsetX:0,offsetY:2,blur:0}},Z:[{id:"0",q:Yc,T:"optionsDifficulty_easy"},{id:"1",q:Xc,T:"optionsDifficulty_medium"},{id:"2",q:Wc,T:"optionsDifficulty_hard"}],Wh:N(30),Xh:N(12),Kg:N(10),qd:2,rd:N(30),fontSize:O({big:40,small:20})},music_toggle:{type:"toggle",q:ie,Da:N(106),Bb:N(40),font:{align:"center",i:"middle",fontSize:O({big:40,
small:20}),fillColor:"#018a17",O:{h:!0,color:"#d2ff7b",offsetX:0,offsetY:2,blur:0}},Z:[{id:"on",q:me,T:"optionsMusic_on"},{id:"off",q:le,T:"optionsMusic_off"}],Wh:N(30),Xh:N(12),Kg:0,qd:2,rd:N(30)},sfx_toggle:{type:"toggle",q:ie,Da:N(106),Bb:N(40),font:{align:"center",i:"middle",fontSize:O({big:40,small:20}),fillColor:"#018a17",O:{h:!0,color:"#d2ff7b",offsetX:0,offsetY:2,blur:0}},Z:[{id:"on",q:ke,T:"optionsSFX_on"},{id:"off",q:je,T:"optionsSFX_off"}],Wh:N(30),Xh:N(12),Kg:0,qd:2,rd:N(30)},music_big_toggle:{type:"toggleText",
q:ie,Da:N(106),Bb:N(40),font:{align:"center",i:"middle",fontSize:O({big:40,small:20}),fillColor:"#018a17",O:{h:!0,color:"#d2ff7b",offsetX:0,offsetY:2,blur:0}},Z:[{id:"on",q:"undefined"!==typeof be?be:void 0,T:"optionsMusic_on"},{id:"off",q:"undefined"!==typeof ce?ce:void 0,T:"optionsMusic_off"}],Wh:N(28,"round"),Xh:N(10),Kg:N(10),qd:2,rd:N(30),fontSize:O({big:40,small:20})},sfx_big_toggle:{type:"toggleText",q:ie,Da:N(106),Bb:N(40),font:{align:"center",i:"middle",fontSize:O({big:40,small:20}),fillColor:"#018a17",
O:{h:!0,color:"#d2ff7b",offsetX:0,offsetY:2,blur:0}},Z:[{id:"on",q:"undefined"!==typeof Zd?Zd:void 0,T:"optionsSFXBig_on"},{id:"off",q:"undefined"!==typeof $d?$d:void 0,T:"optionsSFXBig_off"}],Wh:N(33,"round"),Xh:N(12),Kg:N(10),qd:2,rd:N(30),fontSize:O({big:40,small:20})},language_toggle:{type:"toggleText",q:ie,Da:N(106),Bb:N(40),font:{align:"center",i:"middle",fontSize:O({big:40,small:20}),fillColor:"#018a17",O:{h:!0,color:"#d2ff7b",offsetX:0,offsetY:2,blur:0}},Z:[{id:"en-us",q:Zc,T:"optionsLang_en-us"},
{id:"en-gb",q:$c,T:"optionsLang_en-gb"},{id:"nl-nl",q:ad,T:"optionsLang_nl-nl"},{id:"de-de",q:cd,T:"optionsLang_de-de"},{id:"fr-fr",q:dd,T:"optionsLang_fr-fr"},{id:"pt-br",q:ed,T:"optionsLang_pt-br"},{id:"es-es",q:fd,T:"optionsLang_es-es"},{id:"ru-ru",q:hd,T:"optionsLang_ru-ru"},{id:"it-it",q:kd,T:"optionsLang_it-it"},{id:"ar-eg",q:id,T:"optionsLang_ar-eg"},{id:"ko-kr",q:jd,T:"optionsLang_ko-kr"},{id:"tr-tr",q:bd,T:"optionsLang_tr-tr"},{id:"jp-jp",q:gd,T:"optionsLang_jp-jp"}],Wh:N(40),Xh:N(20),Kg:N(10),
qd:2,rd:N(30),fontSize:O({big:40,small:20})},default_text:{type:"text",q:he,Da:N(40),Bb:N(40),font:{align:"center",i:"middle",fontSize:O({big:40,small:20}),fillColor:"#018a17",O:{h:!0,color:"#d2ff7b",offsetX:0,offsetY:2,blur:0}},qd:2,rd:N(30),fontSize:O({big:40,small:20})},default_image:{type:"image",q:he,Da:N(40),Bb:N(40),rd:N(6)},options:{type:"image",q:fe}},ln:{bigPlay:{type:"text",q:oe,Da:N(40),Bb:N(76),font:{align:"center",i:"middle",fontSize:O({big:40,small:20}),fillColor:"#01198a",O:{h:!0,
color:"#7bfdff",offsetX:0,offsetY:2,blur:0}},qd:2,rd:N(30),fontSize:O({big:40,small:20})}},sk:{green:{font:{align:"center",i:"middle",fillColor:"#018a17",O:{h:!0,color:"#d2ff7b",offsetX:0,offsetY:2,blur:0}}},blue:{font:{align:"center",i:"middle",fillColor:"#01198a",O:{h:!0,color:"#7bfdff",offsetX:0,offsetY:2,blur:0}}},bluegreen:{font:{align:"center",i:"middle",fillColor:"#004f89",O:{h:!0,color:"#7bffca",offsetX:0,offsetY:2,blur:0}}},orange:{font:{align:"center",i:"middle",fillColor:"#9a1900",O:{h:!0,
color:"#ffb986",offsetX:0,offsetY:2,blur:0}}},orangeyellow:{font:{align:"center",i:"middle",fillColor:"#8d2501",O:{h:!0,color:"#ffbe60",offsetX:0,offsetY:2,blur:0}}},pink:{font:{align:"center",i:"middle",fillColor:"#c6258f",O:{h:!0,color:"#ffbde9",offsetX:0,offsetY:2,blur:0}}},white:{font:{align:"center",i:"middle",fillColor:"#ffffff"}},pastel_pink:{font:{align:"center",i:"middle",fillColor:"#83574f"}},whiteWithRedBorder:{font:{align:"center",i:"middle",fillColor:"#ffffff",O:{h:!0,color:"#4c0200",
offsetX:0,offsetY:2,blur:0}}},whiteWithBlueBorder:{font:{align:"center",i:"middle",fillColor:"#ffffff",O:{h:!0,color:"#002534",offsetX:0,offsetY:2,blur:0}}}},buttons:{default_color:"green"},La:{Gy:20},Bd:{backgroundImage:"undefined"!==typeof se?se:void 0,Nw:0,Ju:500,rl:5E3,ww:5E3,jt:-1,Dy:12,Cy:100,Xe:N(78),Bp:{align:"center"},om:N(560),Bh:N(400),Ch:{align:"center"},vg:N(680),qf:N(16),Bo:N(18),oj:N(8),rs:N(8),ss:N(9),ts:N(9),Kj:{align:"center",fillColor:"#3B0057",fontSize:N(24)},Lt:{align:"center"},
Mt:N(620),nm:N(500),pj:"center",xg:N(500),rj:N(60),Wb:{align:"center"},Oc:{align:"bottom",offset:N(20)},Go:N(806),Eo:500,lw:N(20)},Do:{pj:"right",om:N(280),vg:N(430),xg:N(340),Wb:{align:"right",offset:N(32)},Oc:N(560),Go:N(560)},em:{jn:N(860),backgroundImage:void 0!==typeof se?se:void 0,tv:700,Is:1800,Iw:700,lx:2600,uh:void 0!==typeof se?ye:void 0,yd:700,dj:{align:"center"},Tk:{align:"center"},ej:void 0!==typeof ye?-ye.height:0,cj:{align:"top",offset:N(20)},Xn:1,xr:1,Yn:1,yr:1,Wn:1,wr:1,xv:L,yv:tc,
vv:L,wv:L,uv:L,kx:{align:"center"},Pl:N(656),xj:N(300),Nl:700,jx:700,ar:N(368),Dk:N(796),Ti:N(440),$q:700,No:N(36),vl:N(750),Hw:500,pj:"center",xg:N(500),rj:N(60),Wb:{align:"center"},Oc:{align:"bottom",offset:N(20)},Go:N(806),Eo:500,lw:N(20)},wp:{jn:N(0),Pl:N(456),xj:N(320),ar:{align:"center"},Dk:N(346),Ti:N(460),No:{align:"left",offset:N(32)},vl:N(528),pj:"right",xg:N(340),Wb:{align:"right",offset:N(32)},Oc:N(560),Go:N(560)},rg:{bx:{align:"center",offset:N(-230)},Uo:{align:"top",offset:N(576)},ax:"options",
sd:{i:"bottom"},Qg:{align:"center"},Kd:{align:"top",offset:N(35,"round")},de:N(232),Gf:N(98),Sy:{align:"center",offset:N(-206)},Tp:{align:"top",offset:N(30)},Ry:{align:"center",offset:N(206)},Sp:{align:"top",offset:N(30)},type:"grid",Yw:3,PA:3,Zw:5,QA:4,dr:!0,gv:!0,io:N(78),Ar:{align:"top",offset:N(140)},Cr:{align:"top",offset:N(140)},Br:N(20),Dv:N(18),Ev:N(18),aw:{ao:{fontSize:O({big:60,small:30}),fillColor:"#3F4F5E",align:"center",i:"middle",O:{h:!0,color:"#D0D8EA",offsetX:0,offsetY:N(6),blur:0}}},
bw:{ao:{fontSize:O({big:32,small:16}),fillColor:"#3F4F5E",align:"center",i:"middle",O:{h:!0,color:"#D0D8EA",offsetX:0,offsetY:N(2),blur:0}}},ls:N(438),ms:N(438),ds:{align:"center"},es:{align:"center"},vs:{align:"center"},ws:{align:"center",offset:N(-22)},hs:{align:"center"},is:{align:"center",offset:N(-10)},fy:{align:"center",offset:N(216)},pt:{align:"top",offset:N(574)},ot:{fontSize:O({big:24,small:12}),fillColor:"#3F4F5E",align:"center"},qt:N(10),ap:{fontSize:O({big:24,small:12}),fillColor:"#3F4F5E",
align:"center"},Qs:{align:"center"},Rs:{align:"top",offset:N(588)},ox:N(160),nx:N(40),backgroundImage:"undefined"!==typeof s_screen_levelselect?s_screen_levelselect:void 0,xy:N(10),yy:200,wy:N(200),mA:N(600),Tw:800,Sw:500},fs:{Tp:{align:"top",offset:N(20)},Sp:{align:"top",offset:N(20)},Kd:{align:"top",offset:N(25,"round")},io:N(234),Ar:{align:"top",offset:N(110)},Cr:{align:"top",offset:N(110)},pt:{align:"top",offset:N(536)},Rs:{align:"top",offset:N(550)},Uo:{align:"top",offset:N(538)}},ml:{md:"undefined"!==
typeof qe?qe:void 0,Ns:{align:"center"},Xo:"undefined"!==typeof qe?-qe.height:void 0,Il:[{type:"y",Na:0,duration:800,end:{align:"center",offset:N(-142)},hb:tc,Rb:Kf}],Wo:[{type:"y",Na:0,duration:600,end:"undefined"!==typeof qe?-qe.height:void 0,hb:sc,Dq:!0}],qq:{align:"center",i:"middle"},rq:{align:"center"},sq:0,Fi:N(500),$m:N(80),Fr:{align:"center",i:"middle"},Hr:{align:"center"},Ir:0,dl:N(560),Gr:N(80),Os:3500},yo:{Il:[{type:"y",Na:0,duration:800,end:{align:"center"},hb:tc,Rb:Kf}]},sz:{md:"undefined"!==
typeof s_overlay_challenge_start?s_overlay_challenge_start:void 0,Ns:{align:"center"},Xo:N(56),Kl:0,Ll:0,sd:{align:"center",i:"top"},de:N(500),Gf:N(100),Qg:{align:"center"},Kd:N(90),yA:{align:"center",i:"middle"},DA:N(500),CA:N(80),HA:{align:"center"},IA:N(250),uB:{align:"center",i:"top"},wB:N(500),vB:N(40),xB:{align:"center"},yB:N(348),tB:{align:"center",i:"top"},AB:N(500),zB:N(50),CB:{align:"center"},DB:N(388),mC:{align:"center",i:"top"},oC:N(500),nC:N(40),rC:{align:"center"},sC:N(442),pC:0,qC:0,
lC:{align:"center",i:"top"},uC:N(500),tC:N(50),vC:{align:"center"},wC:N(482),kC:N(10),iC:0,jC:0,Ei:800,Wm:tc,Xm:600,Ym:sc,Os:3500},rz:{$y:500,Ei:800,MA:1500,NA:500,BB:2500,GB:500,EB:3200,FB:800,sA:4200,tA:300,kz:4500,VA:{align:"center"},WA:N(-800),TA:{align:"center"},UA:N(52),Kl:0,Ll:0,Nk:.8,mr:"#000000",Oo:{align:"center",i:"middle"},uA:N(360),pA:N(120),qA:N(4),rA:N(4),vA:{align:"center"},wA:N(340),UB:{align:"center"},VB:N(600),TB:N(500),SB:N(120),RB:{align:"center",i:"middle"},xC:{align:"center",
i:"middle"},BC:N(360),yC:N(60),zC:N(4),AC:N(4),CC:{align:"center"},DC:N(480),aC:N(460),WB:{align:"center"},XB:N(400),lz:{align:"center"},mz:N(500),KA:{align:"center",i:"middle"},LA:N(75,"round"),JA:N(48),OA:N(120),GA:N(214,"round"),zA:N(40),AA:N(4),BA:N(4),EA:0,FA:0,Kz:{align:"center",i:"middle"},Nz:N(220),Mz:N(180),Lz:N(80),Iz:N(4),Jz:N(4)},ua:{Jl:{yn:"undefined"!==typeof s_overlay_difficulty?s_overlay_difficulty:void 0,kv:"undefined"!==typeof ue?ue:void 0,cw:"undefined"!==typeof s_overlay_level_win?
s_overlay_level_win:void 0,$v:"undefined"!==typeof s_overlay_level_fail?s_overlay_level_fail:void 0},By:500,Ei:800,Wm:tc,Xm:800,Ym:lc,tc:{align:"center"},Zb:0,sd:{align:"center",i:"middle",fontSize:O({big:26,small:13})},Qg:{align:"center"},Kd:N(58),de:N(500),Gf:N(100),zt:{align:"center",i:"middle",fontSize:O({big:56,small:28})},ry:{align:"center"},sy:N(236),Cn:{align:"center",i:"top",fontSize:O({big:24,small:12})},hr:{align:"center"},Dn:N(144),Vi:{align:"center",i:"top",fontSize:O({big:56,small:28})},
Jk:{align:"center"},ph:N(176),Ik:N(200),Hk:N(60),Gj:{align:"center",i:"top",fontSize:O({big:24,small:12})},zf:{align:"center"},Gg:N(286),wt:N(0),tr:!1,Id:N(14),im:N(10),Fg:{align:"center",i:"top",fontSize:O({big:24,small:12})},Qh:N(10),Rh:N(4),Sh:N(200),QB:N(50),Hu:{align:"center",offset:N(12)},vq:N(549),sv:{align:"center",offset:N(162)},ur:N(489),Ni:{align:"center",offset:N(250)},kh:N(10),jh:N(90),cg:N(90),qp:{align:"center",offset:N(-177,"round")},rp:N(120),sp:{align:"center"},tp:N(96),up:{align:"center",
offset:N(179,"round")},vp:N(120),OB:200,by:500,lt:800,nt:0,ey:0,dy:300,cy:200,mt:300,Nk:.8,Ub:800,mr:"#000000",Lo:N(508),ul:N(394),ys:N(96),zs:N(74),sl:3,Dh:400,xw:2500,oA:0,Aw:N(100),As:1.5,Fw:{align:"center"},Gw:N(76),tl:N(180),Ew:N(36),Bs:{align:"center",i:"middle",fontSize:O({big:22,small:12}),H:"ff_opensans_extrabold",fillColor:"#1d347f",O:{h:!0,color:"#68cbfa",offsetY:N(2)}},xs:500,yw:500,zw:N(-30),Cw:500,Bw:0,Dw:4E3,um:600,Jy:1500,Fq:500,gh:750,Mv:{align:"center"},Nv:N(290),Or:N(350),Pw:1E3,
type:{level:{nk:"level",nd:!0,Nh:!0,Lj:"title_level",Af:"totalScore",lk:"retry",Pk:"next"},failed:{nk:"failed",nd:!1,Nh:!1,Lj:"title_level",At:"subtitle_failed",lk:"exit",Pk:"retry"},endless:{nk:"endless",nd:!1,Nh:!0,Lj:"title_endless",En:"totalScore",Af:"highScore",lk:"exit",Pk:"retry"},difficulty:{nk:"difficulty",nd:!1,Nh:!0,Lj:"title_difficulty",En:"timeLeft",Af:["totalScore","timeBonus"],lk:"exit",Pk:"retry"}}},cs:{kh:N(0),Kd:N(30),Dn:N(114),ph:N(146),Gg:N(266),vq:N(488),ur:N(428),Lo:{align:"center",
offset:N(220)},ul:N(260)},lj:{backgroundImage:"undefined"!==typeof xe?xe:void 0},options:{backgroundImage:re,tc:{align:"center"},Zb:0,sd:{},Qg:{align:"center"},Kd:N(58),de:N(500),Gf:N(100),uk:N(460,"round"),tk:{align:"center"},Ji:{align:"center",offset:N(36)},Qd:N(10,"round"),Ni:N(510),kh:N(10),jh:N(130),cg:N(90),buttons:{startScreen:["tutorial",["music","sfx"],"language","moreGames","about"],levelMapScreen:["startScreen",["music","sfx"],"language","moreGames","about"],inGame:["resume","tutorial",
["music","sfx"],"moreGames","quit"]},uj:800,vj:tc,Gl:600,Hl:lc,Tq:{align:"center"},tn:N(260),xk:N(460),sn:N(300),Rq:{align:"center"},rn:N(460),Qq:{align:"center"},qn:N(560,"round"),Pi:N(460,"round"),Ul:{},Ld:"undefined"!==typeof te?te:void 0,xm:{align:"center"},If:N(84,"round"),zm:{align:"center",i:"top"},Am:N(480),Jp:N(46),bu:{align:"center"},Kp:N(110,"round"),Zt:{align:"center"},Hp:N(160,"round"),au:{align:"center"},Ip:N(446,"round"),ym:{i:"middle",align:"center",fontSize:O({big:36,small:18})},
Yh:N(480),$t:N(160),Yt:{align:"center",offset:N(-80,"round")},Gp:N(556,"round"),Xt:{align:"center",offset:N(80,"round")},Fp:N(556,"round"),ek:{align:"center",i:"top",fillColor:"#3C0058",fontSize:O({big:26,small:13}),bc:N(6)},fk:N(480),jq:N(50),gk:{align:"center"},xi:N(106,"round"),zi:{align:"center",i:"top",fillColor:"#3C0058",fontSize:O({big:26,small:13}),bc:N(6)},Rf:N(480),Ai:N(110),ah:{align:"center"},Bi:N(396,"round"),yi:{align:"center"},hk:N(140),Qm:{align:"center"},vi:N(500),wi:N(480),Rm:{align:"center",
i:"top",fillColor:"#808080",fontSize:O({big:12,small:8})},mq:{align:"center"},Sm:N(610),lq:N(440),kq:N(20),bh:N(200),ik:N(200),lu:N(80),mu:N(140),ku:N(10)},cx:{Kd:N(12),Ji:{align:"center",offset:N(16)},tn:N(200),sn:N(300),rn:N(400),qn:N(500,"round"),If:N(60,"round"),Kp:N(80,"round"),Hp:N(134,"round"),Ip:N(410,"round"),Gp:N(500,"round"),Fp:N(500,"round"),xi:N(86,"round"),hk:N(126),Bi:N(392,"round"),vi:N(490),Sm:N(590)},Js:{backgroundImage:"undefined"!==typeof s_overlay_challenge_options?s_overlay_challenge_options:
re,tc:{align:"center"},Zb:N(120),sd:{},Qg:{align:"center"},Kd:N(200),uk:N(460,"round"),tk:{align:"center"},Ji:{align:"center",offset:N(140)},Qd:N(10,"round"),Ni:N(510),kh:N(10),jh:N(130),cg:N(90),buttons:{startScreen:["tutorial",["music","sfx"],"language","about"],inGame_challengee:["resume","tutorial",["music","sfx"],"forfeitChallenge"],inGame_challenger:["resume","tutorial",["music","sfx"],"cancelChallenge"]},uj:800,vj:tc,Gl:600,Hl:lc,Ul:{},kB:{align:"center"},lB:N(360),jB:N(460),iB:N(300),eB:"default_text",
fB:{align:"center"},gB:N(630),bB:"default_text",cB:{align:"center"},dB:N(730,"round"),hB:N(460,"round"),Sq:{},Tq:{align:"center"},tn:N(200),xk:N(460),sn:N(250),Rq:{align:"center"},rn:N(520),Qq:{align:"center"},qn:N(620,"round"),Pi:N(460,"round"),Oo:{},Lw:{align:"center"},Mw:N(200),Po:N(460),Kw:N(300),Ld:"undefined"!==typeof te?te:void 0,xm:{align:"center"},If:N(0,"round"),zm:{align:"center",i:"top"},Am:N(480),Jp:N(50),bu:{align:"center"},Kp:N(20,"round"),Zt:{align:"center"},Hp:N(70,"round"),au:{align:"center"},
Ip:N(356,"round"),ym:{i:"middle",align:"center",fontSize:O({big:36,small:18})},Yh:N(480),$t:N(150),Yt:N(224,"round"),Gp:N(636,"round"),Xt:N(350,"round"),Fp:N(636,"round"),ek:{align:"center",i:"top",fillColor:"#3C0058",fontSize:O({big:26,small:13}),bc:N(6)},fk:N(480),jq:N(50),gk:{align:"center"},xi:N(26,"round"),zi:{align:"center",i:"top",fillColor:"#3C0058",fontSize:O({big:26,small:13}),bc:N(6)},Rf:N(480),Ai:N(110),ah:{align:"center"},Bi:N(316,"round"),yi:{align:"center"},hk:N(60),Qm:{align:"center"},
vi:N(420),wi:N(480),Rm:{align:"center",i:"top",fillColor:"#808080",fontSize:O({big:12,small:8})},mq:{align:"center"},Sm:N(530),lq:N(440),kq:N(20),bh:N(200),ik:N(200),lu:N(80),mu:N(100),ku:N(10)},xn:{backgroundImage:"undefined"!==typeof s_overlay_dialog?s_overlay_dialog:re,tc:{align:"center"},Zb:N(120),uk:N(460,"round"),tk:{align:"center"},Ji:{align:"bottom",offset:N(20)},Qd:N(10,"round"),Ni:N(510),kh:N(10),jh:N(130),cg:N(90),uj:800,vj:tc,Gl:600,Hl:lc,Ts:{},Ax:{align:"center"},Bx:{align:"center",offset:N(40)},
dp:N(460),cp:N(300),yt:{},yx:{align:"center"},zx:{align:"center",offset:N(160)},xx:N(460),wx:N(200)},Qk:{backgroundImage:"undefined"!==typeof s_screen_end?s_screen_end:void 0,Lt:{align:"center"},Mt:N(152),nm:N(560),Ay:N(560),font:{align:"center",i:"middle",fontSize:O({big:52,small:26}),fillColor:"#FFFFFF"},Ru:{align:"center"},Kq:N(600),Jq:N(460),Iq:"default_text"},Sn:{Kq:N(520)}}}
var Xf={ux:"poki",Ej:{jw:!1,zn:[]},He:{gl:"en-us",kk:"en-us en-gb nl-nl de-de fr-fr pt-br es-es tr-tr ru-ru ar-eg ko-kr".split(" ")},zq:{show:!1}},Yf=null;
function Zf(){Yf={oa:{Hq:250,Pu:N(5),Lk:200,Mk:100,In:1.3,nr:20,qv:N(300),or:700,Rw:1E3,Al:100,qx:90,rx:-.5,yj:200,sx:100,tx:1.275},Aa:{Lk:250,pv:4,Mk:300,In:2,Jn:.75},Bc:{Su:N({x:N(-99,"round"),y:N(26,"floor")}),rw:75,X:[{x:0,y:0,scale:1},{x:-N(55,"round"),y:N(19,"floor"),scale:.6}],scale:1,size:N(10),x:N(275,"round"),y:N(500,"round")},Rd:{Zc:{id:"canvasGame",depth:100,top:N(200,"round"),left:N(46,"round"),width:N(550,"round"),height:N(560,"round")}},gb:{Jn:5},hd:{Qu:!1,Yu:1,scale:1.5,Zx:.5,Ep:200,
Ny:20},jg:{Rk:"Bubbleshooter",Wd:"endless"},j:{hz:1.41},Tz:{Rk:"Bubbleshooter"},Xd:{fv:N(10),Kr:1,lineWidth:N(5),$A:N(5)},ca:{Vv:5},Oe:{bubbles:[0,10,null,null,15,null,null,25,null,null,50,null,null,100,null,null,null,null,null,null,null],Zv:2,Wx:500,Xx:250,et:100},zy:{Wy:void 0,Xy:!1,MB:!1,Vx:!1},kA:9,zo:[{name:"level_1",r:{Pc:1,Ie:7,ye:40,border:10,Ya:5,Fd:500,description:"Description of level"},ba:{speed:N(1.1)},we:{ff:"pink red yellow blue cyan green blocker".split(" "),Eb:[0,10,10,10,0,10,0],
Fb:null,Gb:null,Hb:null,Ib:null,Jb:null,Kb:null,Lb:null,Mb:null,Nb:null},rb:{ef:"bubble_in_field bubble_not_in_field bomb colorbomb fireball perfect_bubble".split(" "),Eb:[90,30,0,0,0],Fb:null,Gb:null,Hb:null,Ib:null,Jb:null,Kb:null,Lb:null,Mb:null,Nb:null,me:[0,0,0,0,0,1],ne:[0,0,0,0,0,1],oe:[0,0,0,0,0,1],pe:[0,0,0,0,0,1],qe:[0,0,0,0,0,1],re:[0,0,0,0,0,1],se:[0,0,0,0,0,1],te:[0,0,0,0,0,1],ue:[0,0,0,0,0,1],le:[0,0,0,0,0,1]},zc:{Aa:10,gb:10,Ee:10,all:10},gb:{nb:N(100)},Aa:{nb:N(100)},ca:{Je:3}},{name:"level_2_Cyan",
r:{Pc:2,Ie:6,ye:50,border:10,Ya:5,Fd:500,description:"Description of level"},ba:{speed:N(1.2)},we:{ff:"pink red yellow blue cyan green blocker".split(" "),Eb:[0,10,10,10,10,10,0],Fb:null,Gb:null,Hb:null,Ib:null,Jb:null,Kb:null,Lb:null,Mb:null,Nb:null},rb:{ef:"bubble_in_field bubble_not_in_field bomb colorbomb fireball perfect_bubble".split(" "),Eb:[90,35,0,0,0],Fb:null,Gb:null,Hb:null,Ib:null,Jb:null,Kb:null,Lb:null,Mb:null,Nb:null,me:[0,0,0,0,0,1],ne:[0,0,0,0,0,1],oe:[0,0,0,0,0,1],pe:[0,0,0,0,0,
1],qe:[0,0,0,0,0,1],re:[0,0,0,0,0,1],se:[0,0,0,0,0,1],te:[0,0,0,0,0,1],ue:[0,0,0,0,0,1],le:[0,0,0,0,0,1]},zc:{Aa:10,gb:10,Ee:10,all:10},gb:{nb:N(100)},Aa:{nb:N(100)},ca:{Je:3}},{name:"level_3_Colorbombs",r:{Pc:5,Ie:6,ye:40,border:10,Ya:5,Fd:500,description:"Description of level"},ba:{speed:N(1.2)},we:{ff:"pink red yellow blue cyan green blocker".split(" "),Eb:[0,10,10,10,10,10,0],Fb:null,Gb:null,Hb:null,Ib:null,Jb:null,Kb:null,Lb:null,Mb:null,Nb:null},rb:{ef:"bubble_in_field bubble_not_in_field bomb colorbomb fireball perfect_bubble".split(" "),
Eb:[90,30,0,999,0],Fb:[90,30,0,3,0],Gb:null,Hb:null,Ib:null,Jb:null,Kb:null,Lb:null,Mb:null,Nb:null,me:[0,0,0,0,0,1],ne:[0,0,0,0,0,1],oe:[0,0,0,0,0,1],pe:[0,0,0,0,0,1],qe:[0,0,0,0,0,1],re:[0,0,0,0,0,1],se:[0,0,0,0,0,1],te:[0,0,0,0,0,1],ue:[0,0,0,0,0,1],le:[0,0,0,0,0,1]},zc:{Aa:10,gb:10,Ee:10,all:10},gb:{nb:N(100)},Aa:{nb:N(100)},ca:{Je:3}},{name:"level_4_Pink",r:{Pc:7,Ie:5,ye:60,border:9,Ya:5,Fd:500,description:"Description of level"},ba:{speed:N(1.2)},we:{ff:"pink red yellow blue cyan green blocker".split(" "),
Eb:[10,10,10,10,10,10,0],Fb:null,Gb:null,Hb:null,Ib:null,Jb:null,Kb:null,Lb:null,Mb:null,Nb:null},rb:{ef:"bubble_in_field bubble_not_in_field bomb colorbomb fireball perfect_bubble".split(" "),Eb:[90,30,0,3,0],Fb:null,Gb:null,Hb:null,Ib:null,Jb:null,Kb:null,Lb:null,Mb:null,Nb:null,me:[0,0,0,0,0,1],ne:[0,0,0,0,0,1],oe:[0,0,0,0,0,1],pe:[0,0,0,0,0,1],qe:[0,0,0,0,0,1],re:[0,0,0,0,0,1],se:[0,0,0,0,0,1],te:[0,0,0,0,0,1],ue:[0,0,0,0,0,1],le:[0,0,0,0,0,1]},zc:{Aa:10,gb:10,Ee:10,all:10},gb:{nb:N(100)},Aa:{nb:N(100)},
ca:{Je:3}},{name:"level_5_Blockers",r:{Pc:10,Ie:5,ye:40,border:9,Ya:5,Fd:500,description:"Description of level"},ba:{speed:N(1.2)},we:{ff:"pink red yellow blue cyan green blocker".split(" "),Eb:[10,10,10,10,10,10,2],Fb:null,Gb:null,Hb:null,Ib:null,Jb:null,Kb:null,Lb:null,Mb:null,Nb:null},rb:{ef:"bubble_in_field bubble_not_in_field bomb colorbomb fireball perfect_bubble".split(" "),Eb:[90,35,0,3,0],Fb:null,Gb:null,Hb:null,Ib:null,Jb:null,Kb:null,Lb:null,Mb:null,Nb:null,me:[0,0,0,0,0,1],ne:[0,0,0,0,
0,1],oe:[0,0,0,0,0,1],pe:[0,0,0,0,0,1],qe:[0,0,0,0,0,1],re:[0,0,0,0,0,1],se:[0,0,0,0,0,1],te:[0,0,0,0,0,1],ue:[0,0,0,0,0,1],le:[0,0,0,0,0,1]},zc:{Aa:10,gb:10,Ee:10,all:10},gb:{nb:N(100)},Aa:{nb:N(100)},ca:{Je:3}},{name:"level_6_bombs",r:{Pc:12,Ie:4,ye:70,border:8,Ya:5,Fd:500,description:"Description of level"},ba:{speed:N(1.2)},we:{ff:"pink red yellow blue cyan green blocker".split(" "),Eb:[10,10,10,10,10,10,4],Fb:null,Gb:null,Hb:null,Ib:null,Jb:null,Kb:null,Lb:null,Mb:null,Nb:null},rb:{ef:"bubble_in_field bubble_not_in_field bomb colorbomb fireball perfect_bubble".split(" "),
Eb:[90,35,999,2,0],Fb:[90,35,2,2,0],Gb:null,Hb:null,Ib:null,Jb:null,Kb:null,Lb:null,Mb:null,Nb:null,me:[0,0,0,0,0,1],ne:[0,0,0,0,0,1],oe:[0,0,0,0,0,1],pe:[0,0,0,0,0,1],qe:[0,0,0,0,0,1],re:[0,0,0,0,0,1],se:[0,0,0,0,0,1],te:[0,0,0,0,0,1],ue:[0,0,0,0,0,1],le:[0,0,0,0,0,1]},zc:{Aa:10,gb:10,Ee:10,all:10},gb:{nb:N(100)},Aa:{nb:N(100)},ca:{Je:3}},{name:"level_7_Fireball",r:{Pc:15,Ie:4,ye:40,border:8,Ya:5,Fd:500,description:"Description of level"},ba:{speed:N(1.2)},we:{ff:"pink red yellow blue cyan green blocker".split(" "),
Eb:[10,10,10,10,10,10,6],Fb:null,Gb:null,Hb:null,Ib:null,Jb:null,Kb:null,Lb:null,Mb:null,Nb:null},rb:{ef:"bubble_in_field bubble_not_in_field bomb colorbomb fireball perfect_bubble".split(" "),Eb:[90,40,2,2,0],Fb:null,Gb:null,Hb:null,Ib:null,Jb:null,Kb:null,Lb:null,Mb:null,Nb:null,me:[0,0,0,0,0,1],ne:[0,0,0,0,0,1],oe:[0,0,0,0,0,1],pe:[0,0,0,0,0,1],qe:[0,0,0,0,0,1],re:[0,0,0,0,0,1],se:[0,0,0,0,0,1],te:[0,0,0,0,0,1],ue:[0,0,0,0,0,1],le:[0,0,0,0,0,1]},zc:{Aa:10,gb:10,Ee:10,all:10},gb:{nb:N(100)},Aa:{nb:N(100)},
ca:{Je:3}},{name:"level_8_theoretical end",r:{Pc:20,Ie:3,ye:80,border:7,Ya:5,Fd:500,description:"Description of level"},ba:{speed:N(1.2)},we:{ff:"pink red yellow blue cyan green blocker".split(" "),Eb:[10,10,10,10,10,10,10],Fb:null,Gb:null,Hb:null,Ib:null,Jb:null,Kb:null,Lb:null,Mb:null,Nb:null},rb:{ef:"bubble_in_field bubble_not_in_field bomb colorbomb fireball perfect_bubble".split(" "),Eb:[90,40,1,1,999],Fb:[90,40,1,1,.5],Gb:null,Hb:null,Ib:null,Jb:null,Kb:null,Lb:null,Mb:null,Nb:null,me:[0,0,
0,0,0,1],ne:[0,0,0,0,0,1],oe:[0,0,0,0,0,1],pe:[0,0,0,0,0,1],qe:[0,0,0,0,0,1],re:[0,0,0,0,0,1],se:[0,0,0,0,0,1],te:[0,0,0,0,0,1],ue:[0,0,0,0,0,1],le:[0,0,0,0,0,1]},zc:{Aa:10,gb:10,Ee:10,all:10},gb:{nb:N(100)},Aa:{nb:N(100)},ca:{Je:3}},{name:"level_9_impossible",r:{Pc:100,Ie:2,ye:90,border:7,Ya:5,Fd:500,description:"Description of level"},ba:{speed:N(1.2)},we:{ff:"pink red yellow blue cyan green blocker".split(" "),Eb:[10,10,10,10,10,10,10],Fb:null,Gb:null,Hb:null,Ib:null,Jb:null,Kb:null,Lb:null,Mb:null,
Nb:null},rb:{ef:"bubble_in_field bubble_not_in_field bomb colorbomb fireball perfect_bubble".split(" "),Eb:[90,90,1,1,.1],Fb:null,Gb:null,Hb:null,Ib:null,Jb:null,Kb:null,Lb:null,Mb:null,Nb:null,me:[0,0,0,0,0,1],ne:[0,0,0,0,0,1],oe:[0,0,0,0,0,1],pe:[0,0,0,0,0,1],qe:[0,0,0,0,0,1],re:[0,0,0,0,0,1],se:[0,0,0,0,0,1],te:[0,0,0,0,0,1],ue:[0,0,0,0,0,1],le:[0,0,0,0,0,1]},zc:{Aa:10,gb:10,Ee:10,all:10},gb:{nb:N(100)},Aa:{nb:N(100)},ca:{Je:3}}]}}var $f=$f||{};$f.aj={Sk:"00000000000000000000000000000000",bm:"0000000000000000000000000000000000000000"};
var ag={};
function bg(){ag={Uz:"PopCharmPlus",buttons:{default_color:"green",bigPlay:"blue"},sc:{fn:1,Hi:500},em:{Ku:[{q:se,x:0,y:0},{q:"undefined"!==typeof ye?ye:void 0,y:N(20,"round"),x:{align:"center"}}]},rg:{Ku:[{q:"undefined"!==typeof s_screen_levelselect?s_screen_levelselect:void 0,x:0,y:0}],sd:{H:gf.H,align:"center",i:"middle",fillColor:"#004f5d",fontSize:O({big:36,small:18})},ot:{H:gf.H,fontSize:O({big:34,small:18}),fillColor:"#004f5d",align:"center"},ap:{H:gf.H,fontSize:O({big:34,small:18}),fillColor:"#004f5d",
align:"center"}},ml:{Xo:-qe.height,qq:{align:"center",i:"top",fontSize:O({big:34,small:16}),fillColor:"#75e757"},rq:{align:"center"},sq:N(412,"round"),Fi:N(500),$m:N(80),Fr:{H:gf.H,fontSize:O({big:72,small:36}),fillColor:"#ffffff",align:"center",i:"middle"},Hr:{align:"center"},Ir:N(370,"round")},ua:{Zb:N(14),sd:{H:gf.H,align:"center",i:"middle",fontSize:O({big:44,small:22}),fillColor:"#4de025"},bC:!0,Cn:{H:gf.H,align:"center",i:"top",fillColor:"#FFFFFF",fontSize:O({big:36,small:18})},ph:N(186),Vi:{align:"center",
i:"top",fillColor:"#FFFFFF",fontSize:O({big:72,small:36})},Gj:{H:gf.H,i:"bottom",fillColor:"#0eb047",fontSize:O({big:36,small:18})},Id:N(4),Fg:{i:"bottom",fillColor:"#01513d",fontSize:O({big:30,small:15})},zt:{H:gf.H,align:"center",i:"middle",fontSize:O({big:72,small:36}),fillColor:"#01513d"}},options:{Zb:N(14),uj:800,vj:tc,Gl:600,Hl:lc,Ul:{align:"center",i:"middle",fontSize:O({big:26,small:13}),fillColor:"#FFFFFF"},sd:{H:gf.H,align:"center",i:"middle",fontSize:O({big:44,small:22}),fillColor:"#4de025"},
ym:{i:"middle",align:"center",fontSize:O({big:26,small:13}),fillColor:"#004f5d"},zm:{align:"center",i:"top",fontSize:O({big:36,small:18}),fillColor:"#004f5d"}},Qk:{font:{H:gf.H,align:"center",i:"middle",fontSize:O({big:72,small:36}),fillColor:"#037564",stroke:!0,pd:N(5,"round"),strokeColor:"#ffffff",Re:!0}}}}M.l=M.l||{};M.l.Fv=function(){var a=M.gy;a?a():console.log("Something is wrong with Framework Init (TG.startFramework)")};M.l.$k=function(){M.e.bd()};M.l.hA=function(){};M.l.pl=function(){};
M.l.al=function(){M.e.bd()};M.l.dA=function(){};M.l.cA=function(){};M.l.gA=function(){};M.l.Tr=function(){};M.l.Tv=function(){};M.l.Sr=function(){};M.l.eA=function(){};M.l.Hv=function(){M.e.bd()};M.l.Iv=function(){M.e.bd()};M.l.zh=function(){M.e.bd()};M.l.Gv=function(){M.e.bd()};M.l.zr=function(a,b){void 0===M.e.Le&&(M.e.Le=new cg(!0));return dg(a,b)};M.l.Lp=function(a){void 0===M.e.Le&&(M.e.Le=new cg(!0));return eg(a)};M.l.Cd=function(a){window.open(a)};M.l.fj=function(){return[{b:rd,url:M.w.Qr}]};
M.l.Uv=function(){};M.Od=M.Od||{};M.Od.$k=function(){M.e.Sj=!1};M.Od.pl=function(){};M.Od.al=function(){M.e.Sj=!1};M.Od.zh=function(){M.e.Sj=!1};function fg(a,b){for(var c in a.prototype)b.prototype[c]=a.prototype[c]}function gg(a,b,c,d){this.sm=this.sh=a;this.Zu=b;this.duration=1;this.Pq=d;this.hf=c;this.vk=null;this.sb=0}function hg(a,b){a.sb+=b;a.sb>a.duration&&a.vk&&(a.vk(),a.vk=null)}
gg.prototype.N=function(){if(this.sb>=this.duration)return this.hf(this.duration,this.sh,this.sm-this.sh,this.duration);var a=this.hf(this.sb,this.sh,this.sm-this.sh,this.duration);this.Pq&&(a=this.Pq(a));return a};function ig(a,b){a.sh=a.N();a.sm=b;a.duration=a.Zu;a.vk=void 0;a.sb=0}M.lv=void 0!==M.environment?M.environment:"development";M.Yy=void 0!==M.ga?M.ga:M.lv;"undefined"!==typeof M.mediaUrl?ja(M.mediaUrl):ja(M.size);M.Gu="backButton";M.of="languageSet";M.xf="resizeEvent";
M.version={builder:"1.8.3.0","build-time":"17:55:15","build-date":"28-04-2020",audio:G.ob?"web audio api":G.Za?"html5 audio":"no audio"};M.jz=new function(){this.lf=this.sw=3;da.s.Th&&(this.lf=3>da.Wa.Ye?1:4.4>da.Wa.Ye?2:3);da.Wa.jl&&(this.lf=7>da.Wa.Ye?2:3);da.Wa.Rp&&(this.lf=8>da.Wa.Ye?2:3);M.version.browser_name=da.name;M.version.browser_version=da.s.version;M.version.os_version=da.Wa.version;M.version.browser_grade=this.lf};M.a={};"function"===typeof Wf&&Wf();"function"===typeof Zf&&Zf();
"function"===typeof bg&&bg();"function"===typeof initGameThemeSettings&&initGameThemeSettings();M.a.u="undefined"!==typeof Vf?Vf:{};M.a.j="undefined"!==typeof Yf?Yf:{};M.a.R="undefined"!==typeof ag?ag:{};M.a.Vz="undefined"!==typeof gameThemeSettingsVar?gameThemeSettingsVar:{};M.Jh=window.publisherSettings;M.w="undefined"!==typeof game_configuration?game_configuration:{};"undefined"!==typeof Xf&&(M.w=Xf);if("undefined"!==typeof $f)for(var jg in $f)M.w[jg]=$f[jg];
(function(){var a,b,c,d,f;M.k={};M.k.eq="undefined"!==typeof P?P:{};M.k.ub=void 0!==M.w.He&&void 0!==M.w.He.kk?M.w.He.kk:M.a.u.He.kk;f=[];for(b=0;b<M.k.ub.length;b++)f.push(M.k.ub[b]);if(M.w.ty)for(b=M.k.ub.length-1;0<=b;b--)0>M.w.ty.indexOf(M.k.ub[b])&&M.k.ub.splice(b,1);try{if(d=function(){var a,b,c,d,f;b={};if(a=window.location.search.substring(1))for(a=a.split("&"),d=0,f=a.length;d<f;d++)c=a[d].split("="),b[c[0]]=c[1];return b}(),d.lang)for(c=d.lang.toLowerCase().split("+"),b=M.k.ub.length-1;0<=
b;b--)0>c.indexOf(M.k.ub[b])&&M.k.ub.splice(b,1)}catch(h){}0===M.k.ub.length&&(0<f.length?M.k.ub=f:M.k.ub.push("en-us"));c=navigator.languages?navigator.languages:[navigator.language||navigator.userLanguage];for(b=0;b<c.length;b++)if("string"===typeof c[b]){f=c[b].toLowerCase();for(d=0;d<M.k.ub.length;d++)if(0<=M.k.ub[d].search(f)){a=M.k.ub[d];break}if(void 0!==a)break}void 0===a&&(a=void 0!==M.w.He&&void 0!==M.w.He.gl?M.w.He.gl:M.a.u.He.gl);M.k.Lm=0<=M.k.ub.indexOf(a)?a:M.k.ub[0];M.k.$j=M.k.eq[M.k.Lm];
if(void 0!==M.a.u.mc.language_toggle&&void 0!==M.a.u.mc.language_toggle.Z){a=M.a.u.mc.language_toggle.Z;c=[];for(b=0;b<a.length;b++)0<=M.k.ub.indexOf(a[b].id)&&c.push(a[b]);M.a.u.mc.language_toggle.Z=c}M.k.I=function(a,b){var c,d,f,h;if(void 0!==M.k.$j&&void 0!==M.k.$j[a]){c=M.k.$j[a];if(d=c.match(/#touch{.*}\s*{.*}/g))for(h=0;h<d.length;h++)f=(f=da.gg.Gt||da.gg.Ds)?d[h].match(/{[^}]*}/g)[1]:d[h].match(/{[^}]*}/g)[0],f=f.substring(1,f.length-1),c=c.replace(d[h],f);return c}return b};M.k.Zs=function(a){M.k.Lm=
a;M.k.$j=M.k.eq[a];na(M.of,a)};M.k.co=function(){return M.k.Lm};M.k.zv=function(){return M.k.ub};M.k.Xv=function(a){return 0<=M.k.ub.indexOf(a)}})();M.dv={Wa:"",ex:"",SA:"",wn:""};M.d={};
M.d.createEvent=function(a,b){var c,d,f,h;d=b.detail||{};f=b.bubbles||!1;h=b.cancelable||!1;if("function"===typeof CustomEvent)c=new CustomEvent(a,{detail:d,bubbles:f,cancelable:h});else try{c=document.createEvent("CustomEvent"),c.initCustomEvent(a,f,h,d)}catch(k){c=document.createEvent("Event"),c.initEvent(a,f,h),c.data=d}return c};M.d.Cp=function(a){var b=Math.floor(a%6E4/1E3);return(0>a?"-":"")+Math.floor(a/6E4)+(10>b?":0":":")+b};
M.d.mj=function(a){function b(){}b.prototype=kg.prototype;a.prototype=new b};M.d.Mx=function(a,b,c,d,f,h){var k=!1,l=document.getElementById(a);l||(k=!0,l=document.createElement("canvas"),l.id=a);l.style.zIndex=b;l.style.top=c+"px";l.style.left=d+"px";l.width=f;l.height=h;k&&((a=document.getElementById("viewport"))?a.appendChild(l):document.body.appendChild(l));M.Rd.push(l);return l};
(function(){var a,b,c,d,f,h,k;M.$r=0;M.as=0;M.am=!1;M.Oy=da.s.Th&&da.s.Ye&&4<=da.s.Ye;M.Tj=!1;M.gu=da.gg.Gt||da.gg.Ds;M.orientation=0<=ba.indexOf("landscape")?"landscape":"portrait";k="landscape"===M.orientation?M.a.u.nn:M.a.u.Rd;h="landscape"===M.orientation?M.a.j.nn:M.a.j.Rd;if(void 0!==h){if(void 0!==h.Zc)for(a in h.Zc)k.Zc[a]=h.Zc[a];if(void 0!==h.$c)for(a in h.$c)k.$c[a]=h.$c[a]}b=function(){var a,b,c,d;if(M.Oy&&!M.Tj){M.Tj=!0;if(a=document.getElementsByTagName("canvas"))for(b=0;b<a.length;b++)if(c=
a[b],!c.getContext||!c.getContext("2d")){M.Tj=!1;return}b=document.createEvent("Event");b.XA=[!1];b.initEvent("gameSetPause",!1,!1);window.dispatchEvent(b);d=[];for(b=0;b<a.length;b++){c=a[b];var f=c.getContext("2d");try{var h=f.getImageData(0,0,c.width,c.height);d.push(h)}catch(k){}f.clearRect(0,0,c.width,c.height);c.style.visibility="hidden"}setTimeout(function(){for(var b=0;b<a.length;b++)a[b].style.visibility="visible"},1);setTimeout(function(){for(var b=0;b<a.length;b++){var c=a[b].getContext("2d");
try{c.putImageData(d[b],0,0)}catch(f){}}b=document.createEvent("Event");b.initEvent("gameResume",!1,!1);window.dispatchEvent(b);M.Tj=!1},100)}};c=function(){var a,c,d,f,h,C,t,s,v;"landscape"===M.orientation?(a=[window.innerWidth,window.innerHeight],c=[k.nh,k.cd],d=k.minWidth):(a=[window.innerHeight,window.innerWidth],c=[k.cd,k.nc],d=k.minHeight);f=c[0]/c[1];h=a[0]/a[1];C=d/c[1];h<f?(h=h<C?Math.floor(a[0]/C):a[1],f=a[0]):(h=a[1],f=Math.floor(a[1]*f));t=h/c[1];!M.gu&&1<t&&(f=Math.min(a[0],c[0]),h=Math.min(a[1],
c[1]),t=1);a="landscape"===M.orientation?f:h;c="landscape"===M.orientation?h:f;v=s=0;window.innerHeight<Math.floor(k.cd*t)&&(s=Math.max(k.wl,window.innerHeight-Math.floor(k.cd*t)));window.innerWidth<Math.floor(k.nc*t)&&(v=Math.floor(Math.max(k.nh-k.nc,(window.innerWidth-Math.floor(k.nc*t))/t)),window.innerWidth<Math.floor(k.nc*t)+v*t&&(v+=Math.floor(Math.max((d-k.nh)/2,(window.innerWidth-(k.nc*t+v*t))/2/t))));M.xq=k.cd-k.Xq;M.Lu=k.nc-k.nh;M.qa=s;M.oz=v;M.nz=Math.min(M.Lu,-1*M.pz);M.kf=(k.$c.top||
k.eg)-M.qa;M.fa={top:-1*s,left:-1*v,height:Math.min(k.cd,Math.round(Math.min(c,window.innerHeight)/t)),width:Math.min(k.nc,Math.round(Math.min(a,window.innerWidth)/t))};M.rB="landscape"===M.orientation?{top:0,left:Math.floor((k.nh-k.minWidth)/2),width:k.minWidth,height:k.minHeight}:{top:Math.abs(k.wl),left:k.dg,width:k.nc,height:k.minHeight};d=Math.min(window.innerHeight,c);a=Math.min(window.innerWidth,a);"landscape"===M.orientation?document.getElementById("viewport").setAttribute("style","position:fixed; overflow:hidden; z-index: 0; width:"+
a+"px; left:50%; margin-left:"+-a/2+"px; height: "+d+"px; top:50%; margin-top:"+-d/2+"px"):document.getElementById("viewport").setAttribute("style","position:absolute; overflow:hidden; z-index: 0; width:"+a+"px; left:50%; margin-left:"+-a/2+"px; height: "+d+"px");d=function(a,b,c,d){var f,h,l,n;f=void 0!==b.top?b.top:k.eg;h=void 0!==b.left?b.left:k.dg;l=void 0!==b.width?b.width:k.nc;n=void 0!==b.height?b.height:k.cd;a.Dz=Math.floor(t*f);a.Cz=Math.floor(t*h);a.Ez=Math.floor(t*l);a.Bz=Math.floor(t*
n);!1!==c&&(f+=s);!1!==d&&(h+=v);a.setAttribute("style","position:absolute; left:"+Math.floor(t*h)+"px; top:"+Math.floor(t*f)+"px; width:"+Math.floor(t*l)+"px; height:"+Math.floor(t*n)+"px; z-index: "+b.depth)};d(M.dn,k.mn);d(M.Rn,k.Zc);d(M.$n,k.$c,!1,!0);d(M.Zd,k.$f);b();setTimeout(b,5E3);setTimeout(b,1E4);setTimeout(b,2E4);na(M.xf)};a=function(){if(M.$r===window.innerHeight&&M.as===window.innerWidth||M.am)return!1;document.documentElement.style["min-height"]=5E3;d=window.innerHeight;f=40;M.am=window.setInterval(function(){document.documentElement.style.minHeight=
"";document.documentElement.style["min-height"]="";window.scrollTo(0,da.s.Th?1:0);f--;if((da.s.Th?0:window.innerHeight>d)||0>f)M.as=window.innerWidth,M.$r=window.innerHeight,clearInterval(M.am),M.am=!1,document.documentElement.style["min-height"]=window.innerHeight+"px",document.getElementById("viewport").style.height=window.innerHeight+"px",c()},10)};M.zd=k.Zc.left||k.dg;M.Ad=k.Zc.top||k.eg;M.kd=k.Zc.width||k.nc;M.bj=k.Zc.height||k.cd;M.mg=k.$c.left||k.dg;M.kf=k.$c.top||k.eg;M.Xz=k.$c.width||k.nc;
M.Wz=k.$c.height||k.cd;M.nw=k.$f.left||k.dg;M.ow=k.$f.top||k.eg;M.pw=k.$f.width||k.nc;M.mw=k.$f.height||k.cd;h=function(a){return M.d.Mx(a.id,a.depth,void 0!==a.top?a.top:k.eg,void 0!==a.left?a.left:k.dg,void 0!==a.width?a.width:k.nc,void 0!==a.height?a.height:k.cd)};M.Rd=[];M.dn=h(k.mn);M.Rn=h(k.Zc);M.$n=h(k.$c);M.Zd=h(k.$f);c();document.body.addEventListener("touchmove",function(){},!0);document.body.addEventListener("touchstart",a,!0);window.addEventListener("resize",a,!0);window.setInterval(a,
200);M.Mc={};M.Mc[M.lg]=M.dn;M.Mc[M.jf]=M.Rn;M.Mc[M.Wk]=M.$n;M.Mc[M.th]=M.Zd;M.Mc[M.kg]=M.dn;M.Mc[M.Cc]=M.Zd;M.Mc[M.Fe]=M.Zd})();
M.d.Bu=function(){var a,b;if(b=document.getElementById("viewport"))a=document.createElement("img"),a.className="banner",a.src=ka.af+"/media/banner_game_640x100.png",a.style.position="absolute",a.style.bottom="0px",a.style.width="100%",a.style.zIndex=300,b.appendChild(a),M.Nu=!0,M.Ii=!0,b=function(a){M.Nu&&M.Ii&&(M.l.Cd("http://localhost:1/html5-games/offline/"),a.preventDefault(),a.stopPropagation?a.stopPropagation():a.cancelBubble=!0)},a.addEventListener("mouseup",b,!0),a.addEventListener("touchend",
b,!0),a.addEventListener("mousedown",function(a){M.Ii&&(a.preventDefault(),a.stopPropagation?a.stopPropagation():a.cancelBubble=!0)},!0),a.addEventListener("touchstart",function(a){M.Ii&&(a.preventDefault(),a.stopPropagation?a.stopPropagation():a.cancelBubble=!0)},!0)};M.d.LB=function(){var a,b=document.getElementsByClassName("banner");if(b){for(a=0;a<b.length;a++)b[a].style.display="inline";M.Ii=!0}};
M.d.bA=function(){var a,b=document.getElementsByClassName("banner");if(b){for(a=0;a<b.length;a++)b[a].style.display="none";M.Ii=!1}};M.d.bo=function(a){return a===M.Rn?{x:M.zd,y:M.Ad}:a===M.$n?{x:M.mg,y:M.kf}:{x:M.nw,y:M.ow}};M.d.ng=function(a){return M.Mc[a]};M.d.ia=function(a){return M.Mc[a]?(m.canvas!==M.Mc[a]&&m.ia(M.Mc[a]),!0):!1};M.d.Ja=function(a,b){if(M.Mc[b]){var c=I;a.Qa!==b&&(c.ti=!0);a.Qa=b;a.canvas=M.Mc[b]}};
M.d.g=function(a,b,c,d){var f;b=b||0;c=c||0;d=d||0;if("number"===typeof a)return a;if("object"===typeof a)switch(f=a.offset||0,a.align){case "center":return Math.round(b/2-(c/2-d))+f;case "left":case "top":return f-d;case "right":case "bottom":return b-c-f-d;default:return f+0}return 0};
M.d.Ba=function(a,b,c,d){var f;b=b||0;c=c||0;if("number"===typeof a)return a;if("object"===typeof a)switch(f=a.offset||0,a.align){case "center":return"center"===d||"middle"===d?Math.round(b/2)+f:"left"===d||"top"===d?Math.round(b/2-c/2)+f:Math.round(b/2+c/2)-f;case "left":case "top":return"center"===d||"middle"===d?Math.round(c/2)+f:"left"===d||"top"===d?f:c+f;case "right":case "bottom":return"center"===d||"middle"===d?b-Math.round(c/2)-f:"left"===d||"top"===d?b-Math.round(c/2)-f:b-f;default:return f+
0}return 0};M.d.vz=function(a,b,c,d){switch(d){case "center":case "middle":return Math.round(b/2)+a;case "left":case "top":return a;case "right":case "bottom":return c+a}return 0};M.ma=M.ma||{};M.ma.Qx=!1;M.ma.Vr=function(a){a instanceof Array&&(this.Sk=a[0],this.bm=a[1],this.Ou="http://api.localhost.invalid/v2x/"+this.Sk,this.Wr=!0)};
M.ma.Of=function(a,b){var c,d=JSON.stringify(b),f=window.Crypto.HmacSHA256(d,this.bm),f=window.Crypto.enc.Base64.stringify(f),h=this.Ou+"/"+a;try{c=new XMLHttpRequest,c.open("POST",h,!0),this.Qx&&(c.onreadystatechange=function(){4===c.readyState&&(200===c.status?(console.log("GOOD! statusText: "+c.statusText),console.log(b)):console.log("ERROR ajax call error: "+c.statusText+", url: "+h))}),c.setRequestHeader("Content-Type","text/plain"),c.setRequestHeader("Authorization",f),c.send(d)}catch(k){}};
M.ma.Ec={Zp:"user",Yp:"session_end",pu:"business",qu:"resource",Uj:"progression",Fm:"design",ERROR:"error"};M.ma.Kf=function(){return{user_id:this.Pp,session_id:this.Lx,build:this.Uu,device:this.wn,platform:this.platform,os_version:this.fx,sdk_version:"rest api v2",v:2,client_ts:Math.floor(Date.now()/1E3),manufacturer:"",session_num:1}};
M.ma.rc=function(a,b,c,d,f,h,k){this.Lx=a;h&&"object"===typeof h&&(this.Pp=h.Pp);this.Uu=f;this.h=!0;this.Wr&&(this.wn=k.wn,this.platform=k.Wa,this.fx=k.ex);this.Of("init",this.Kf())};M.ma.ly=function(a){var b=this.Kf(),c=[];b.category=a;c.push(b);this.Of("events",c)};M.ma.Fn=function(a,b,c,d){a=[];b=this.Kf();b.length=Math.floor(c);b.category=d;a.push(b);this.Of("events",a)};
M.ma.cb=function(a,b,c,d){var f=[],h=!1;if(this.h&&this.Wr){if(d)switch(d){case M.ma.Ec.Zp:this.ly(d);h=!0;break;case M.ma.Ec.Yp:this.Fn(0,0,c,d);h=!0;break;case M.ma.Ec.pu:h=!0;break;case M.ma.Ec.qu:h=!0;break;case M.ma.Ec.Uj:this.ov(a,b,c,d);h=!0;break;case M.ma.Ec.Fm:this.mv(a,b,c,d),h=!0}h||(d="",b&&(d=b instanceof Array?b.toString().replace(",",":"):d+b),b=this.Kf(),b.event_id=d+":"+a,b.value=c,f.push(b),this.Of("design",f))}};M.ma.qB=function(a,b,c){this.cb(a,b,c)};M.ma.Pz=function(){};
M.ma.Qz=function(){};M.ma.ov=function(a,b,c,d){var f=[],h=this.Kf();switch(a){case "Start:":h.category=d;h.event_id=a+b;break;case "Complete:":h.category=d;h.event_id=a+b;h.score=c;break;case "Fail:":h.category=d,h.event_id=a+b,h.score=c}f.push(h);this.Of("events",f)};M.ma.mv=function(a,b,c,d){var f=[],h=this.Kf();h.category=d;h.event_id=a+b;h.value=c;f.push(h);this.Of("events",f)};M.ma.Us=function(a,b){var c=[],d=this.Kf();d.category="error";d.message=a;d.severity=b;c.push(d);this.Of("events",c)};
function lg(){this.Qa=this.depth=0;this.visible=!1;this.h=!0;this.a=M.a.u.La;this.px=this.a.Gy;J(this);Rb(this,"system")}function mg(){var a=ng("userId","");""===a&&(a=og(),pg("userId",a));return a}function og(){return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(a){var b=16*Math.random()|0;return("x"===a?b:b&3|8).toString(16)})}e=lg.prototype;e.start=function(a){M.ma.Vr(a);M.ma.rc(og(),M.a.j.jg.Rk,M.a.R.id,M.w.ux,qg(),{Pp:mg()},M.dv)};e.cb=function(a,b,c,d){M.ma.cb(a,b,c,d)};
function rg(a,b,c,d){var f,h;for(f=0;f<a.ja.length;f++)void 0!==a.ja[f]&&a.ja[f].tag===b&&(h=a.ja[f],a.cb(c,d,h.m/1E3,M.ma.Ec.Yp),h.h=!1)}function sg(){var a=M.La,b=M.e.Og,c;for(c=0;c<a.ja.length;c++)void 0!==a.ja[c]&&a.ja[c].tag===b&&(a.ja[c].paused+=1)}e.Us=function(a,b){M.ma.Us(a,b)};e.Vb=function(){this.ja=[]};
e.Y=function(a){var b,c=0;for(b=0;b<this.ja.length;b++)this.ja[b].h&&(0===this.ja[b].paused&&(this.ja[b].m+=a),c=b);c<this.ja.length-1&&(a=this.ja.length-Math.max(this.px,c+1),0<a&&this.ja.splice(this.ja.length-a,a))};
function cg(a,b,c){this.us=a||!1;this.host=b||"http://localhost:8080";this.Kx=c||this.host+"/services/storage/gamestate";this.Ct="undefined"!==typeof window.localStorage;this.to=this.Np=!1;var d=this;window.parent!==window&&(da.s.jp||da.Wa.jl)&&(window.addEventListener("message",function(a){a=a.data;var b=a.command;"init"===b?d.Np="ok"===a.result:"getItem"===b&&d.Xk&&("ok"===a.result?d.Xk(a.value):d.Xk(a.defaultValue))},!1),this.Xk=null,window.parent.postMessage({command:"init"},"*"));this.tj=[];
window.setTimeout(function(){d.to=!0;for(var a=0;a<d.tj.length;++a)d.tj[a]();d.tj=[]},2E3)}function tg(){return"string"===typeof M.w.xt&&""!==M.w.xt?M.w.xt:void 0!==M.a.j.jg&&void 0!==M.a.j.jg.Rk?M.a.j.jg.Rk:"0"}function dg(a,b){var c=M.e.Le;"function"===typeof b&&(c.to?ug(c,a,b):c.tj.push(function(){ug(c,a,b)}))}function eg(a){var b=M.e.Le;b.to?vg(b,a):b.tj.push(function(){vg(b,a)})}
function vg(a,b){var c=null,d=tg();try{c=JSON.stringify({lastChanged:new Date,gameState:JSON.stringify(b)})}catch(f){}if(a.Np)window.parent.postMessage({command:"setItem",key:"PG_"+d,value:c},"*");else{if(a.Ct)try{window.localStorage.setItem(d,c)}catch(h){}a.us||(c=new ub("gameState_"+d),c.text=void 0===JSON?"":JSON.stringify(b),vb(c,a.Kx+"/my_ip/"+d))}}
function ug(a,b,c){var d=null,f=null,h=tg();if(a.Np)a.Xk=function(a){var f;try{d=JSON.parse(a),f=JSON.parse(d.gameState)}catch(h){f=b}c(f)},window.parent.postMessage({command:"getItem",key:"PG_"+h},"*");else{if(a.Ct)try{(d=window.localStorage.getItem(h))&&(d=JSON.parse(d))}catch(k){c(b);return}a.us||(a=new ub("gameState_"+h),f=null,wb(a,cg.mB+"/my_ip/"+h)&&(f=void 0===JSON?{}:JSON.parse(a.text)));try{if(d){if(f&&Date.parse(f.lastChanged)>Date.parse(d.lastChanged)){c(JSON.parse(f.gameState));return}c(JSON.parse(d.gameState));
return}if(f){c(JSON.parse(f.gameState));return}}catch(l){c(b);return}c(b)}}
function wg(a,b,c){console&&console.log&&console.log("Hosted on: "+(window.location.origin?window.location.origin:window.location.protocol+"//"+window.location.hostname));this.depth=1E3;this.jd=this.visible=!1!==c;this.h=!0;M.d.Ja(this,M.Cc);var d;this.a=M.a.u.Bd;if("landscape"===M.orientation&&M.a.u.Do)for(d in M.a.u.Do)this.a[d]=M.a.u.Do[d];for(d in M.a.R.Bd)this.a[d]=M.a.R.Bd[d];if(M.w.Bd)for(d in M.w.Bd)this.a[d]=M.w.Bd[d];this.Db=a;this.Mq=b;this.br=!1;this.Gi=0;this.en=!1;this.mk=0;this.Hi=
this.a.Ju;this.ep=!0;this.iw=.6/Math.log(this.a.rl+1);this.nu=void 0!==M.w.hw?M.w.hw:this.a.Nw;this.tw=this.nu+this.a.ww;J(this)}e=wg.prototype;e.np=function(a){var b;M.d.ia(M.kg);sa(0,0,this.canvas.width,this.canvas.height,"white",!1);b=W.P();(M.w.Bd&&M.w.Bd.Kj||this.a.Kj)&&A(b,M.w.Bd&&M.w.Bd.Kj?M.w.Bd.Kj:this.a.Kj);a=M.k.I(a,"<"+a.toUpperCase()+">");b.o(a,this.canvas.width/2,this.canvas.height/2,this.a.nm);this.error=!0;this.visible=this.jd=!1;this.canvas.W=!0};
e.Me=function(){this.va&&(this.Wb=M.d.g(this.a.Wb,M.fa.width,this.va.width)+M.fa.left,this.Oc=M.d.g(this.a.Oc,M.fa.height,this.va.height)+M.fa.top)};
e.un=function(){var a,b,c,d,f,h;if("function"===typeof M.l.fj&&(h=this.a.xg,(this.Ia=M.l.fj())&&0<this.Ia.length)){this.va?this.va.clear():this.va=new r(this.a.xg,this.a.rj);x(this.va);h/=this.Ia.length;for(c=0;c<this.Ia.length;c++)try{f=this.Ia[c].b,d=Math.min(1,Math.min((h-20)/f.width,this.a.rj/f.height)),a="center"===this.a.pj?h*c+Math.round((h-f.width*d)/2):h*c+Math.round(h-f.width*d)-10,b=this.va.height-f.height*d,f instanceof p?f.S(0,a,b,d,d,0,1):m.context.drawImage(f,a,b,f.width*d,f.height*
d)}catch(k){}y(this.va);this.ql=0;this.Fo=!0;this.qj=0;this.wg=Xb(0,0,this.va.width,this.va.height);this.Me()}};
e.Pa=function(){var a,b,c,d;this.ep?m.clear():M.d.ia(M.kg);if(this.a.backgroundImage)if(d=this.a.backgroundImage,a=Math.abs(M.qa),1<d.D){c=(m.canvas.height-a)/d.lh;b=-(d.Oi*c-m.canvas.width)/2;c=m.context;var f=c.globalAlpha,h,k,l;c.globalAlpha=this.Gi;for(h=0;h<d.D;h+=1)k=b+h%d.Fh*d.width,l=a+d.height*Math.floor(h/d.Fh),d.We.Ca(d.Bf[h],d.Cf[h],d.Df[h],d.Te[h],d.Se[h],k-d.$a+d.Ue[h],l-d.Ua+d.Ve[h]);c.globalAlpha=f}else c=(this.canvas.height-a)/d.height,b=-Math.floor((d.width*c-this.canvas.width)/
2),d instanceof p?d.S(0,b,a,c,c,0,this.Gi):d instanceof r&&d.S(b,a,c,c,0,this.Gi);d=this.a.qf+this.a.Bo+this.a.Bh;b=Fc.height;a=Fc.width-(this.a.qf+this.a.Bo);this.Ch=M.d.g(this.a.Ch,m.canvas.width,d);this.vg=M.d.g(this.a.vg,m.canvas.height,b);Fc.Ca(0,0,0,this.a.qf,b,this.Ch,this.vg,1);Fc.Fk(0,this.a.qf,0,a,b,this.Ch+this.a.qf,this.vg,this.a.Bh,b,1);Fc.Ca(0,this.a.qf+a,0,this.a.Bo,b,this.Ch+this.a.qf+this.a.Bh,this.vg,1)};
function xg(a){a.ep&&(a.en=!0);a.visible&&(a.Pa(),a.un(),"function"===typeof M.l.fo&&(a.Qe=M.l.fo(),a.Qe instanceof r&&(a.Oh=!0,a.ht=Math.floor((a.canvas.width-a.Qe.width)/2),a.it=Math.floor((a.canvas.height-a.Qe.height)/2))));M.e.ol&&ka.be("audio");M.e.nl&&ka.be("audio_music");ka.be("fonts")}
e.Vb=function(){var a,b=!1;if(void 0!==M.w.Ej)if(!1===M.w.Ej.jw)b=!0;else{if(void 0!==M.w.Ej.zn)for(a=0;a<M.w.Ej.zn.length;a++){var c;a:{c=M.w.Ej.zn[a];var d=void 0,f=void 0,h=d=void 0,f=void 0,f=window.location.origin?window.location.origin:window.location.protocol+"//"+window.location.hostname;if(0===f.indexOf("file://")&&c===yg("file://"))c=!0;else{f=f.split(".");d=f.shift().split("://");d[0]+="://";f=d.concat(f);h="";for(d=f.length-1;0<=d;d--)if(h=f[d]+(0<d&&d<f.length-1?".":"")+h,yg(h)===c){c=
!0;break a}c=!1}}if(c){b=!0;break}}}else b=!0;b&&"number"===typeof M.w.Ey&&(new Date).getTime()>M.w.Ey&&(b=!1);b?(this.ih=[],this.error=!1,this.Ot=this.On=this.jk=this.m=0,this.ready=this.Oh=!1,this.fw=void 0!==this.a.ss?this.a.ss:this.a.qf-this.a.oj,this.gw=void 0!==this.a.ts?this.a.ts:Math.floor((Fc.height-Be.height)/2),this.Co=Be.width-(this.a.oj+this.a.rs),this.Nn=this.Fs=this.tq=!1,(this.Fj=ka.complete("start"))&&xg(this),this.qs=ka.complete("load"),this.visible&&(this.Pt=document.getElementById("throbber_image"),
this.Xe=this.a.Xe,this.Bp=M.d.g(this.a.Bp,this.canvas.width,this.Xe),this.om=M.d.g(this.a.om,this.canvas.height,this.Xe))):I.pause()};
e.Y=function(a){this.m+=a;"function"===typeof M.l.fo&&void 0===this.Qe&&(this.Qe=M.l.fo(),this.Qe instanceof r&&(this.Oh=!0,this.ht=Math.floor((this.canvas.width-this.Qe.width)/2),this.it=Math.floor((this.canvas.height-this.Qe.height)/2)));this.Oh&&0<=this.a.jt&&this.m>=this.a.jt&&(this.Oh=!1);this.en&&(this.mk+=a,this.mk>=this.Hi?(this.en=!1,this.Gi=1):this.Gi=lc(this.mk,0,1,this.Hi));this.Fj&&(this.jk+=a,this.On+=a);this.Ot=Math.round(this.m/this.a.Cy%(this.a.Dy-1));this.Fo&&(this.ql=0+this.qj/
this.a.Eo*1,this.qj+=a,this.qj>=this.a.Eo&&(this.Fo=!1,this.ql=1));"function"===typeof this.Mq&&this.Mq(Math.round((la("load")+la("audio")+la("audio_music"))/2));!this.ready&&this.qs&&(this.Nn||this.On>=this.a.rl)&&(!M.e.ol||this.tq||G.Za&&this.jk>=this.a.rl)&&(!M.e.nl||this.Fs||G.Za&&this.jk>=this.a.rl)&&(this.ready=!0);if(a=!this.br&&!this.error&&this.ready&&this.m>=this.nu)a=M.e,a=(a.wd&&a.fc&&!a.fc.Wv()?!1:!0)||this.m>=this.tw;a&&(this.br=!0,this.Db())};
e.xh=function(a,b,c){!this.Oh&&this.wg&&dc(this.wg,this.Wb,this.Oc,b,c)&&(this.yb=Math.floor((b-this.Wb)/(this.va.width/this.Ia.length)))};e.yh=function(a,b,c){void 0!==this.yb&&(this.Ia[this.yb].url||this.Ia[this.yb].action)&&dc(this.wg,this.Wb,this.Oc,b,c)&&(b-=this.Wb,b>=this.va.width/this.Ia.length*this.yb&&b<this.va.width/this.Ia.length*(this.yb+1)&&(this.Ia[this.yb].url?M.l.Cd(this.Ia[this.yb].url):this.Ia[this.yb].action()));this.yb=void 0};
e.Kc=function(a,b){"Load Complete"===a&&"start"===b.lb?(this.Fj=!0,xg(this)):"Load Complete"===a&&"load"===b.lb?this.qs=!0:"Load Complete"===a&&"audio"===b.lb?this.tq=!0:"Load Complete"===a&&"audio_music"===b.lb?this.Fs=!0:"Load Complete"===a&&"fonts"===b.lb&&(this.Nn=!0);a===M.xf&&this.Me()};
e.ya=function(){if(!this.error){this.ep&&this.Fj?this.Pa():m.clear();try{this.Pt&&m.context.drawImage(this.Pt,this.Xe*this.Ot,0,this.Xe,this.Xe,this.Bp,this.om,this.Xe,this.Xe)}catch(a){}if(this.Fj){var b=0,c=this.Ch+this.fw,d=this.vg+this.gw,f=Be.height;Be.Ca(0,b,0,this.a.oj,f,c,d,1);b+=this.a.oj;c+=this.a.oj;this.ready?(Be.Fk(0,b,0,this.Co,f,c,d,this.a.Bh,f,1),b+=this.Co,c+=this.a.Bh,Be.Ca(0,b,0,this.a.rs,f,c,d,1)):Be.Fk(0,b,0,this.Co,f,c,d,Math.floor(Math.min((la("load")+la("audio"))/500+this.iw*
Math.log(this.m+1),1)*this.a.Bh),f,1);this.va&&this.va.dd(this.Wb,this.Oc,this.ql)}this.Oh&&this.Qe.o(this.ht,this.it)}};
function zg(){var a,b;b=this;this.depth=100;this.h=this.visible=!0;M.d.Ja(this,M.Cc);this.a=M.a.u.em;if("landscape"===M.orientation&&M.a.u.wp)for(a in M.a.u.wp)this.a[a]=M.a.u.wp[a];this.mc=M.a.u.mc;if("landscape"===M.orientation&&M.a.u.ln)for(a in M.a.u.ln)this.mc[a]=M.a.u.ln[a];for(a in M.a.R.em)this.a[a]=M.a.R.em[a];this.ih=[];a=Ag(M.e);this.Nq=void 0!==a&&null!==a;this.Ta=new ec;this.Ta.V(this.a.tv,function(){b.st.call(b)});this.Ta.V(this.a.Is,function(){b.ut.call(b)});this.Ta.V(M.n.dm&&!this.Nq?
this.a.lx:this.a.Is,function(){b.vt.call(b)});this.Ta.V(this.a.Iw,function(){b.tt.call(b)});J(this,!1)}e=zg.prototype;e.st=function(){this.Uk=!0;this.a.uh&&(this.dj=M.d.g(this.a.dj,this.canvas.width,ye.width),this.Tk=M.d.g(this.a.Tk,this.canvas.width,ye.width),this.ej=M.d.g(this.a.ej,this.canvas.height,ye.height),this.cj=M.d.g(this.a.cj,this.canvas.height,ye.height),this.Zn=this.dj,this.Vk=this.ej,this.Un=this.a.Xn,this.Vn=this.a.Yn,this.Tn=this.a.Wn,this.Jc=0,this.Me())};
e.ut=function(a){function b(a,b,c,d){return rc(a,b,c,d,3,15)}var c,d;M.n.dm&&!this.Nq&&(c=M.d.g(this.a.ar,this.canvas.width,this.a.Ti,Math.floor(this.a.Ti/2)),d=M.d.g(this.a.Dk,this.canvas.height,ie.height,Math.floor(ie.height/2)),c=new Bg("difficulty_toggle",c,d,this.depth-20,Cg()+"",this.a.Ti,{da:function(a){Dg(parseInt(a,10));return!0},qc:!0}),c.Dd=Math.floor(this.a.Ti/2),c.Ed=Math.floor(ie.height/2),!1!==a&&(Eg(c,"xScale",b,0,1,this.a.$q),Eg(c,"yScale",b,0,1,this.a.$q)),this.Ck=c,this.Dk=c.y,
this.ih.push(c),this.Me())};
e.vt=function(a){function b(a,b,c,d){return rc(a,b,c,d,3,15)}var c,d=this;this.$o=!0;c=new Fg("bigPlay",M.d.g(this.a.kx,this.canvas.width,this.a.xj,Math.floor(this.a.xj/2)),M.d.g(this.a.Pl,this.canvas.height,oe.height,Math.floor(oe.height/2)),this.depth-20,"startScreenPlay",this.a.xj,{da:function(){K(I,d);var a=M.e,b,c,l;void 0===M.e.sc&&(void 0!==M.a.R.sc&&(void 0!==M.a.R.sc.Mu&&(b=M.a.R.sc.Mu),void 0!==M.a.R.sc.fn&&(G.$d("music",M.a.R.sc.fn),a.yg()||qb("music"),M.e.Xw=M.a.R.sc.fn),c=void 0!==M.a.R.sc.Iu?
M.a.R.sc.Iu:0,l=void 0!==M.a.R.sc.Hi?M.a.R.sc.Hi:0),void 0===b&&"undefined"!==typeof pf&&(b=pf),void 0!==b&&(M.e.sc=G.play(b,c,l),M.e.sc&&(G.nq(M.e.sc,"music"),G.$s(M.e.sc,!0))));M.n.Mh&&!a.wd?a.screen=new Gg:Hg(a,0);return!0},qc:!0});c.Dd=Math.floor(this.a.xj/2);c.Ed=Math.floor(oe.height/2);!1!==a?(Eg(c,"xScale",b,0,1,this.a.Nl),Eg(c,"yScale",b,0,1,this.a.Nl),this.Ol=0):this.Ol=this.a.Nl;this.Ml=c;this.Pl=c.y;this.ih.push(c);this.Me()};
function Ig(a){var b=vc([tc,function(a,b,f,h){return rc(a,b,f,h,3,2)},ic],[!0,!1,!1],[.02,.1,.88]);a.Ps=!0;Eg(a.Ml,"xScale",uc(b),1,.25,4E3);Eg(a.Ml,"yScale",uc(b),1,-.1,4E3)}e.tt=function(a){var b;this.Cs=!0;b=new kg(M.d.g(this.a.No,this.canvas.width,fe.width),M.d.g(this.a.vl,this.canvas.height,fe.height),this.depth-20,new Zb(fe),[fe],{da:M.e.Pe,qc:!0});!1!==a&&Eg(b,"alpha",L,0,1,this.a.Hw);this.Mo=b;this.vl=b.y;this.ih.push(b);this.Me()};
e.Pa=function(){var a,b,c,d;if(a=this.a.backgroundImage)M.d.ia(M.kg),c=Math.abs(M.qa),1<a.D?(b=(m.canvas.height-c)/a.lh,d=-(a.Oi*b-m.canvas.width)/2,wa(a,d,c)):(b=(m.canvas.height-c)/a.height,d=-Math.floor((a.width*b-this.canvas.width)/2),a.S(0,d,c,b,b,0,1))};
e.un=function(){var a,b,c,d,f,h;if("function"===typeof M.l.fj&&(h=this.a.xg,(this.Ia=M.l.fj())&&0<this.Ia.length)){this.va?this.va.clear():this.va=new r(this.a.xg,this.a.rj);x(this.va);h/=this.Ia.length;for(c in this.Ia)try{f=this.Ia[c].b,d=Math.min(1,Math.min((h-20)/f.width,this.a.rj/f.height)),a="center"===this.a.pj?h*c+Math.round((h-f.width*d)/2):h*c+Math.round(h-f.width*d)-10,b=this.va.height-f.height*d,f instanceof p?f.S(0,a,b,d,d,0,1):m.context.drawImage(f,a,b,f.width*d,f.height*d)}catch(k){}y(this.va);
this.ql=0;this.Fo=!0;this.qj=0;this.wg=Xb(0,0,this.va.width,this.va.height);this.Me()}};e.Me=function(){var a;a=0;M.fa.height<this.a.jn&&(a=this.a.jn-M.fa.height);this.$o&&(this.Ml.y=this.Pl-a);this.Cs&&(this.Mo.y=this.vl-a,this.Mo.x=M.d.g(this.a.No,M.fa.width,fe.width)+M.fa.left);this.Ck&&(this.Ck.y=this.Dk-a);this.Uk&&this.Jc>=this.a.yd&&(this.Vk=this.cj-M.qa);this.va&&(this.Wb=M.d.g(this.a.Wb,M.fa.width,this.va.width)+M.fa.left,this.Oc=M.d.g(this.a.Oc,M.fa.height,this.va.height)+M.fa.top)};
e.Vb=function(){this.Pa();this.a.uh&&(M.d.ia(M.Cc),this.a.uh.o(0,0,-this.a.uh.height-10));this.un();this.Ta.start()};e.jb=function(){var a;for(a=0;a<this.ih.length;a++)K(I,this.ih[a])};
e.Y=function(a){this.canvas.W=!0;this.Uk&&this.Jc<this.a.yd&&(this.Zn=this.a.xv(this.Jc,this.dj,this.Tk-this.dj,this.a.yd),this.Vk=this.a.yv(this.Jc,this.ej,this.cj-this.ej,this.a.yd)-M.qa,this.Un=this.a.vv(this.Jc,this.a.Xn,this.a.xr-this.a.Xn,this.a.yd),this.Vn=this.a.wv(this.Jc,this.a.Yn,this.a.yr-this.a.Yn,this.a.yd),this.Tn=this.a.uv(this.Jc,this.a.Wn,this.a.wr-this.a.Wn,this.a.yd),this.Jc+=a,this.Jc>=this.a.yd&&(this.Zn=this.Tk,this.Vk=this.cj-M.qa,this.Un=this.a.xr,this.Vn=this.a.yr,this.Tn=
this.a.wr));this.$o&&(!this.Ps&&this.Ol>=this.a.Nl+this.a.jx&&Ig(this),this.Ol+=a)};e.xh=function(a,b,c){this.wg&&dc(this.wg,this.Wb,this.Oc,b,c)&&(this.yb=Math.floor((b-this.Wb)/(this.va.width/this.Ia.length)))};
e.yh=function(a,b,c){void 0!==this.yb&&(this.Ia[this.yb].url||this.Ia[this.yb].action)&&dc(this.wg,this.Wb,this.Oc,b,c)&&(b-=this.Wb,b>=this.va.width/this.Ia.length*this.yb&&b<this.va.width/this.Ia.length*(this.yb+1)&&(this.Ia[this.yb].url?M.l.Cd(this.Ia[this.yb].url):this.Ia[this.yb].action()));this.yb=void 0};e.Ob=function(){this.wb=!0};
e.Pb=function(){this.wb&&(this.Ta.stop(),this.Uk?this.Jc<this.a.yd&&(this.Jc=this.a.yd-1):(this.st(),this.Jc=this.a.yd-1),this.Ck?Jg(this.Ck):this.ut(!1),this.Cs?Jg(this.Mo):this.tt(!1),this.$o?(Jg(this.Ml),this.Ps&&Ig(this)):this.vt(!1),this.wb=!1)};e.Kc=function(a){a===M.xf&&(this.Pa(),this.Me())};e.ya=function(){this.Uk&&this.a.uh&&this.a.uh.S(0,this.Zn,this.Vk,this.Un,this.Vn,0,this.Tn);this.va&&this.va.o(this.Wb,this.Oc);this.jd=!1};
function Gg(){this.depth=100;this.h=this.visible=!0;M.d.Ja(this,M.Cc);var a;this.a=M.a.u.rg;if("landscape"===M.orientation)for(a in M.a.u.fs)this.a[a]=M.a.u.fs[a];this.Ga=M.a.j.lA;if(M.a.j.rg)for(a in M.a.j.rg)this.a[a]=M.a.j.rg[a];this.Ac=M.a.u.mc;for(var b in M.a.R.rg)this.a[b]=M.a.R.rg[b];this.ug=-1;this.Sa=0;this.zo=[];J(this)}e=Gg.prototype;
e.Pa=function(){var a,b,c,d;M.d.ia(M.kg);if(a=this.a.backgroundImage?this.a.backgroundImage:void 0)c=Math.abs(M.qa),1<a.D?(b=(m.canvas.height-c)/a.lh,d=-(a.Oi*b-m.canvas.width)/2,wa(a,d,c)):(b=(m.canvas.height-c)/a.height,d=-Math.floor((a.width*b-this.canvas.width)/2),a.S(0,d,c,b,b,0,1));var f;b=M.a.u.ua.type[M.n.Wd].nd;M.a.j.ua&&M.a.j.ua.type&&M.a.j.ua.type[M.n.Wd]&&M.a.j.ua.type[M.n.Wd]&&(b=!1===M.a.j.ua.type[M.n.Wd].nd?!1:b);void 0!==this.Ga&&void 0!==this.Ga.nd&&(b=this.Ga.nd);c=M.d.g(this.a.fy,
this.canvas.width,Lc.width);a=M.d.g(this.a.pt,M.fa.height,Lc.height)+M.fa.top;b&&(Lc.o(0,c,a),b=W.P(),A(b,this.a.ot),E(b,"center"),b.o(this.J+" / "+this.Dp,c+Math.floor(Lc.width/2),a+Lc.height+this.a.qt));if(void 0!==this.Ga&&void 0!==this.Ga.Tx?this.Ga.Tx:1)b=W.P(),void 0!==this.a.mx?A(b,this.a.mx):A(b,this.a.ap),c=M.k.I("levelMapScreenTotalScore","<TOTAL SCORE:>"),d=Va(b,c,this.a.ox,this.a.nx),d<b.fontSize&&D(b,d),d=M.d.Ba(this.a.Qs,this.canvas.width,b.$(c),b.align),f=M.d.Ba(this.a.Rs,M.fa.height,
b.U(c),b.i)+M.fa.top,b.o(c,d,f),c=""+this.Rl,A(b,this.a.ap),d=M.d.Ba(this.a.Qs,this.canvas.width,b.$(c),b.align),b.o(c,d,a+Lc.height+this.a.qt)};
function Kg(a){if("grid"===a.a.type){x(a.nj);m.clear();a.sg=[];var b;b=function(b,d,f){var h,k,l,n,q,u,B,C,t,s,v,w,T,ya,Z,pa,Ra,gb,Vd,wc,ae,hc,Lf;k=M.n.la[b];Vd=a.ic?a.a.Dv:a.a.Ev;wc=a.a.io;ae=Vd;if(a.a.Xu)h=a.a.Xu[b];else{gb=a.ic?a.a.Yw:a.a.Zw;for(hc=Math.floor(k/gb);1<Math.abs(hc-gb);)gb-=1,hc=Math.floor(k/gb);for(h=[];0<k;)h.push(Math.min(gb,k)),k-=gb}hc=h.length;Ra=Math.round(((a.ic?a.a.ls:a.a.ms)-(hc+1)*Vd)/hc);Lf=a.a.Vu?a.a.Vu:!1;if(!Lf){gb=1;for(k=0;k<hc;k++)gb=Math.max(h[k],gb);pa=Math.round((a.canvas.width-
2*wc)/gb)}for(k=n=0;k<hc;k++){gb=h[k];Lf&&(pa=Math.round((a.canvas.width-2*wc)/gb));for(l=0;l<gb;l++){t=a.a.dr;T=a.a.gv;v=M.n.Si||"locked";w=0;q=Lg(b,n,void 0,void 0);"object"===typeof q&&null!==q&&(void 0!==q.state&&(v=q.state),"object"===typeof q.stats&&null!==q.stats&&(w=q.stats.stars||0));ya="locked"===v;"function"===typeof M.j.Av&&(u=M.j.Av(Mg(M.e,b,n),b,n,v))&&(T=ya=t=!1);q=wc+d;C=ae;Z=s=1;if(!1!==T){B=a.ic?Gc:Mc;if("played"===v)switch(w){case 1:B=a.ic?Hc:Nc;break;case 2:B=a.ic?Ic:Oc;break;
case 3:B=a.ic?Jc:Pc}else a.ic||"locked"!==v||(B=Sc);B.width>pa&&(Z=pa/B.width);B.height>Ra&&(Z=Math.min(s,Ra/B.height));q+=Math.round((pa-B.width*Z)/2);C+=Math.round((Ra-B.height*Z)/2);B.S(0,q,C,Z,Z,0,1);f&&(a.sg[n]={x:q,y:C})}u&&(u.width>pa&&(s=pa/u.width),u.height>Ra&&(s=Math.min(s,Ra/u.height)),void 0!==B?(w=M.d.g(a.a.ds,B.width*Z,u.width*s),T=M.d.g(a.a.es,B.height*Z,u.height*s)):(w=M.d.g(a.a.ds,pa,u.width*s),T=M.d.g(a.a.es,Ra,u.height*s),f&&(a.sg[n]={x:q+w,y:C+T})),u instanceof r?u.S(q+w,C+T,
s,s,0,1):u.S(0,q+w,C+T,s,s,0,1));!1===t||ya||(t=""+(M.n.Pj?n+1:Mg(M.e,b,n)+1),s=a.fonts.ao,"locked"===v&&void 0!==a.fonts.kw?s=a.fonts.kw:"unlocked"===v&&void 0!==a.fonts.My?s=a.fonts.My:"played"===v&&void 0!==a.fonts.played&&(s=a.fonts.played),void 0!==B?(w=M.d.Ba(a.a.hs,B.width*Z,s.$(t),s.align),T=M.d.Ba(a.a.is,B.height*Z,s.U(t),s.i)):(w=M.d.Ba(a.a.hs,pa,s.$(t),s.align),T=M.d.Ba(a.a.is,Ra,s.U(t),s.i)),s.o(t,q+w,C+T));a.ic&&ya&&(void 0!==B?(w=M.d.g(a.a.vs,B.width*Z,Kc.width),T=M.d.g(a.a.ws,B.height*
Z,Kc.height)):(w=M.d.g(a.a.vs,pa,Kc.width),T=M.d.g(a.a.ws,Ra,Kc.height)),Kc.o(0,q+w,C+T));wc+=pa;n++}wc=a.a.io;ae+=Ra+Vd}};a.ij&&b(a.B-1,0);b(a.B,a.canvas.width,!0);a.hj&&b(a.B+1,2*a.canvas.width);y(a.nj)}}function Ng(a,b){switch(b-a.B){case 0:a.Qo=0;break;case 1:a.Qo=-a.canvas.width;break;case -1:a.Qo=a.canvas.width}a.Ke=!0;a.zl=0;a.moveStart=a.Sa;a.Es=a.Qo-a.Sa;a.yl=Math.min(a.a.Tw-a.Vh,Math.round(Math.abs(a.Es)/(a.jm/1E3)));a.yl=Math.max(a.a.Sw,a.yl)}
function Og(a){if(1<M.n.la.length){var b,c;b=M.d.g(a.a.Sy,a.canvas.width,Rc.width);c=M.d.g(a.a.Tp,M.fa.height,Rc.height)+M.fa.top;a.uf=new kg(b,c,a.depth-20,new Zb(Rc),[Rc],function(){a.ce="previous";Ng(a,a.B-1);return!0});b=M.d.g(a.a.Ry,a.canvas.width,Qc.width);c=M.d.g(a.a.Sp,M.fa.height,Qc.height)+M.fa.top;a.sf=new kg(b,c,a.depth-20,new Zb(Qc),[Qc],function(){a.ce="next";Ng(a,a.B+1);return!0});Pg(a)}else a.pf-=a.a.Br}
function Pg(a){if(1<M.n.la.length){var b;a.ij?(b=[Rc],a.uf.xb=!0):(b=[new r(Rc.width,Rc.height)],x(b[0]),Rc.o(1,0,0),y(b[0]),a.uf.xb=!1);Qg(a.uf,b);a.hj?(b=[Qc],a.sf.xb=!0):(b=[new r(Qc.width,Qc.height)],x(b[0]),Qc.o(1,0,0),y(b[0]),a.sf.xb=!1);Qg(a.sf,b)}}
function Rg(a){var b,c,d;x(a.Pg);m.clear();b=W.P();a.a.sd&&A(b,a.a.sd);E(b,"center");F(b,"middle");c=M.k.I("levelMapScreenWorld_"+a.B,"<LEVELMAPSCREENWORLD_"+a.B+">");d=Va(b,c,a.a.de-(b.stroke?b.pd:0),a.a.Gf-(b.stroke?b.pd:0),!1);d<b.fontSize&&D(b,d);b.o(c,a.Pg.width/2,a.Pg.height/2);y(a.Pg);a.canvas.W=!0}
e.Vb=function(){var a,b,c,d=this;this.ic=this.a.ic?!0:!1;if(!this.ic){for(a=0;a<M.n.la.length;a++)if(9<M.n.la[a]){b=!0;break}b||(this.ic=!0)}this.nj=new r(3*this.canvas.width,this.ic?this.a.ls:this.a.ms);this.js=-this.canvas.width;this.ks=this.ic?this.a.Ar:this.a.Cr;this.pf=M.d.g(this.ks,M.fa.height,this.nj.height)+M.fa.top;this.Pg=new r(this.a.de,this.a.Gf);this.Hy=M.d.g(this.a.Qg,this.canvas.width,this.a.de);this.St=M.d.g(this.a.Kd,M.fa.height,this.Pg.height)+M.fa.top;this.gs="undefined"!==typeof s_level_mask?
s_level_mask:this.ic?Zb(Gc):Zb(Mc);this.a.dr&&(this.fonts={},a=function(a){var b,c;for(b in a)c=W.P(),A(c,a[b]),d.fonts[b]=c},this.fonts={},this.fonts.ao=W,this.ic?a(this.a.aw):a(this.a.bw));this.B=M.e.B;this.la=M.n.la[this.B];this.km=!1;this.jm=this.zp=this.Vh=0;this.Ap=this.js;this.Sa=0;this.ij=0<this.B;this.hj=this.B<M.n.la.length-1;for(b=this.Dp=this.Rl=this.J=0;b<M.n.la.length;b++)for(a=0;a<M.n.la[b];a++)c=Sg(void 0,a,b),this.Dp+=3,"object"===typeof c&&null!==c&&(this.J+=void 0!==c.stars?c.stars:
0,this.Rl+=void 0!==c.highScore?c.highScore:0);M.j.Cv&&(this.Rl=M.j.Cv());this.Pa();a=this.Ac[this.a.ax];this.To=new kg(M.d.g(this.a.bx,this.canvas.width,a.q.width),M.d.g(this.a.Uo,M.fa.height,a.q.height)+M.fa.top,this.depth-20,new Zb(a.q),[a.q],{da:M.e.Pe,ta:this});Og(this);Kg(this);Rg(this);this.jd=!0};e.jb=function(){this.uf&&K(I,this.uf);this.sf&&K(I,this.sf);K(I,this.To)};
e.Ob=function(a,b,c){if(!this.Ke)for(a=0;a<this.sg.length;a++)if(dc(this.gs,this.sg[a].x-this.canvas.width,this.sg[a].y+this.pf,b,c)){this.ug=a;break}this.Ke=!1;1<M.n.la.length&&(this.km=!0,this.Vh=0,this.Et=this.Ap=b,this.jm=this.zp=0)};
e.Pb=function(a,b,c){if(!this.Ke&&-1!==this.ug&&dc(this.gs,this.sg[this.ug].x-this.canvas.width,this.sg[this.ug].y+this.pf,b,c)&&(a=M.n.Si||"locked",b=Lg(this.B,this.ug,void 0,void 0),"object"===typeof b&&null!==b&&void 0!==b.state&&(a=b.state),"locked"!==a))return K(I,this),Hg(M.e,this.ug,this.B),!0;this.ug=-1;this.km=!1;1<M.n.la.length&&(Math.abs(this.Sa)>=this.a.xy&&(this.jm>=this.a.yy||Math.abs(this.Sa)>=this.a.wy)?"previous"===this.ce?this.ij&&0<=this.Sa&&this.Sa<=this.canvas.width/2?Ng(this,
this.B-1):(0>this.Sa||(this.ce="next"),Ng(this,this.B)):"next"===this.ce&&(this.hj&&0>=this.Sa&&this.Sa>=-this.canvas.width/2?Ng(this,this.B+1):(0<this.Sa||(this.ce="previous"),Ng(this,this.B))):0<Math.abs(this.Sa)&&(this.ce="next"===this.ce?"previous":"next",Ng(this,this.B)));return!0};
e.Kc=function(a){if(a===M.of||a===M.xf)this.canvas.W=!0,this.Pa(),a===M.xf?(this.St=M.d.g(this.a.Kd,M.fa.height,this.Pg.height)+M.fa.top,this.pf=M.d.g(this.ks,M.fa.height,this.nj.height)+M.fa.top,this.To.y=M.d.g(this.a.Uo,M.fa.height,this.To.images[0].height)+M.fa.top,this.uf&&(this.uf.y=M.d.g(this.a.Tp,M.fa.height,Rc.height)+M.fa.top),this.sf&&(this.sf.y=M.d.g(this.a.Sp,M.fa.height,Qc.height)+M.fa.top),void 0===this.sf&&void 0===this.uf&&(this.pf-=this.a.Br)):(Rg(this),Kg(this))};
e.Ge=function(a){var b=I.ha[0].x;this.km&&(this.zp=Math.abs(this.Ap-b),0<this.Vh&&(this.jm=this.zp/(this.Vh/1E3)),this.ce=b>this.Ap?"previous":"next",this.Vh+=a,this.Sa+=b-this.Et,this.Et=b,this.canvas.W=!0);this.Ke&&(b=this.yl,this.Sa=this.moveStart+this.Es*jc(b-this.zl,1,-1,b,2),this.zl>=this.yl&&(this.Ke=!1,this.Sa=0),this.zl+=a,this.canvas.W=!0);if(this.Ke||this.km)"previous"===this.ce&&this.Sa>=this.canvas.width/2?0<=this.B-1?(this.B-=1,this.la=M.n.la[this.B],this.ij=0<this.B,this.hj=this.B<
M.n.la.length-1,Pg(this),this.Sa-=this.canvas.width,Rg(this),Kg(this),this.canvas.W=!0,this.moveStart-=this.canvas.width):this.Sa=Math.round(this.canvas.width/2):"next"===this.ce&&this.Sa<=-this.canvas.width/2&&(this.B+1<M.n.la.length?(this.B+=1,this.la=M.n.la[this.B],this.ij=0<this.B,this.hj=this.B<M.n.la.length-1,Pg(this),this.Sa+=this.canvas.width,Rg(this),Kg(this),this.canvas.W=!0,this.moveStart+=this.canvas.width):this.Sa=Math.round(-this.canvas.width/2))};
e.ya=function(){this.Pg.o(this.Hy,this.St);this.nj.o(Math.round(this.js+this.Sa),this.pf);this.jd=!1};
function Tg(a,b,c,d){this.depth=10;this.h=this.visible=!0;M.d.Ja(this,M.Cc);var f;this.type=b.failed?"failed":a;this.a=M.a.u.ua;this.Ga=this.a.type[this.type];if("landscape"===M.orientation)for(f in M.a.u.cs)this.a[f]=M.a.u.cs[f];for(f in M.a.R.ua)this.a[f]=M.a.R.ua[f];if(M.a.R.ua&&M.a.R.ua.type&&M.a.R.ua.type[this.type])for(f in M.a.R.ua.type[this.type])this.a[f]=M.a.R.ua.type[this.type][f];if("failed"===this.type){if(void 0!==M.a.j.ua&&M.a.j.ua.type&&void 0!==M.a.j.ua.type.failed)for(f in M.a.j.ua.type[this.type])this.Ga[f]=
M.a.j.ua.type[this.type][f]}else{if(void 0!==M.a.j.ua&&void 0!==M.a.j.ua.type)for(f in M.a.j.ua.type[this.type])this.Ga[f]=M.a.j.ua.type[this.type][f];for(f in M.a.j.ua)this.Ga[f]=M.a.j.ua[f]}this.za=b;this.da=c;this.ta=d;this.ay=[Of,Pf,Qf];this.Yf=[];this.Ta=new ec;this.Ta.parent=this;J(this,!1)}
function Ug(a){var b;for(b=0;b<a.J.length;b++)Vg(a.J[b]);for(b=0;b<a.Dg.length;b++)K(I,a.Dg[b]);a.Dg=[];a.Ra&&Vg(a.Ra);a.Ra=void 0;for(b=0;b<a.buttons.length;b++)a.buttons[b].xb=!1;a.Ta.stop();a.Ta=void 0;Wg(a)}
function Xg(a,b){var c;switch(b){case "title_level":c=M.k.I("levelEndScreenTitle_level","<LEVELENDSCREENTITLE_LEVEL>").replace("<VALUE>",a.za.level);break;case "title_endless":c=M.k.I("levelEndScreenTitle_endless","<LEVELENDSCREENTITLE_ENDLESS>").replace("<VALUE>",a.za.stage);break;case "title_difficulty":c=M.k.I("levelEndScreenTitle_difficulty","<LEVELENDSCREENTITLE_DIFFICULTY>")}void 0!==c&&a.Ic(a.a.sd,c,a.a.Qg,a.a.Kd,a.a.de,a.a.Gf)}
function Yg(a,b){var c;switch(b){case "subtitle_failed":c=M.k.I("levelEndScreenSubTitle_levelFailed","<LEVEL_FAILED>")}void 0!==c&&a.Ic(a.a.zt,c,a.a.ry,a.a.sy)}
function Zg(a,b,c){var d,f,h,k,l;f=M.k.I(b.key,"<"+b.key.toUpperCase()+">");d=b.df?b.toString(b.Eg):b.toString(b.ed);h=a.a.Gj;h.align="left";h.i="top";l=W.P();A(l,h);c?(F(l,"bottom"),h=a.a.Fg,h.align="left",h.i="bottom",c=W.P(),A(c,h),h=k=0,void 0!==f&&(h+=l.$(f)+a.a.im),void 0!==d&&(h+=c.$(d)),h=M.d.g(a.a.zf,a.canvas.width,h)-a.f.x,void 0!==f&&(l.o(f,h,a.Jd+l.fontSize),h+=l.$(f)+a.a.im,k+=l.U(f)),void 0!==d&&(b.df?(d=c.U(d),l=a.Jd+l.fontSize-d,b.Ri=new $g(h,l,a.a.Sh,d,a.depth-100,b.Eg,c,a.a.Qh,a.a.Rh,
a.f,b.toString),k=Math.max(k,d)):(c.o(d,h,a.Jd+l.fontSize+a.a.wt),k=Math.max(k,c.U(d)))),0<k&&(a.Jd+=k+a.a.Id)):(void 0!==f&&(a.Ic(h,f,a.a.zf,a.a.Gg),k=a.a.Gg,"object"===typeof k?(k.offset=void 0!==k.offset?k.offset+a.a.Id:a.a.Id,k.offset+=l.U(f)):"number"===typeof k&&(k+=a.a.Id+l.U(f))),void 0!==d&&(h=a.a.Fg,h.i="top",b.df?(c=W.P(),h.align="center",A(c,h),f=M.d.g(a.a.zf,a.canvas.width,a.a.Sh)-a.f.x,l=k-a.f.y,b.Ri=new $g(f,l,a.a.Sh,c.U(d),a.depth-100,b.Eg,c,a.a.Qh,a.a.Rh,a.f,b.toString)):a.Ic(h,d,
a.a.zf,k)))}
function ah(a,b,c){var d,f,h,k,l,n;switch(b){case "totalScore":d=""+a.za.totalScore;f=M.k.I("levelEndScreenTotalScore","<LEVENENDSCREENTOTALSCORE>");n=0;break;case "highScore":f=M.k.I("levelEndScreenHighScore","<LEVENENDSCREENHIGHSCORE>");d=""+a.za.highScore;break;case "timeLeft":f=M.k.I("levelEndScreenTimeLeft","<LEVENENDSCREENTIMELEFT>");d=""+a.za.timeLeft;break;case "timeBonus":f=M.k.I("levelEndScreenTimeBonus","<LEVENENDSCREENTIMEBONUS>"),d=""+a.za.timeBonus,n=a.za.timeBonus}h=a.a.Gj;h.align=
"left";h.i="top";l=W.P();A(l,h);c?(F(l,"bottom"),h=a.a.Fg,h.align="left",h.i="bottom",c=W.P(),A(c,h),h=k=0,void 0!==f&&(h+=l.$(f)+a.a.im),void 0!==d&&(h+=c.$(d)),h=M.d.g(a.a.zf,a.canvas.width,h)-a.f.x,void 0!==f&&(l.o(f,h,a.Jd+l.fontSize),h+=l.$(f)+a.a.im,k+=l.U(f)),void 0!==d&&(void 0!==n?(d=c.U(d),l=a.Jd+l.fontSize-d,n=new $g(h,l,a.a.Sh,d,a.depth-100,n,c,a.a.Qh,a.a.Rh,a.f),k=Math.max(k,d)):(c.o(d,h,a.Jd+l.fontSize+a.a.wt),k=Math.max(k,c.U(d)))),0<k&&(a.Jd+=k+a.a.Id)):(void 0!==f&&(a.Ic(h,f,a.a.zf,
a.a.Gg),k=a.a.Gg,"object"===typeof k?(k.offset=void 0!==k.offset?k.offset+a.a.Id:a.a.Id,k.offset+=l.U(f)):"number"===typeof k&&(k+=a.a.Id+l.U(f))),void 0!==d&&(h=a.a.Fg,h.i="top",void 0!==n?(c=W.P(),h.align="center",A(c,h),f=M.d.g(a.a.zf,a.canvas.width,a.a.Sh)-a.f.x,l=k-a.f.y,n=new $g(f,l,a.a.Sh,c.U(d),a.depth-100,n,c,a.a.Qh,a.a.Rh,a.f)):a.Ic(h,d,a.a.zf,k)));n instanceof $g&&("totalScore"===b?a.Tg=n:a.Yf.push(n))}
function bh(a,b){var c,d,f;c=M.k.I(b.key,"<"+b.key.toUpperCase()+">");d=b.df?b.toString(b.Eg):b.toString(b.ed);void 0!==c&&a.Ic(a.a.Cn,c,a.a.hr,a.a.Dn);void 0!==d&&(b.df?(c=W.P(),d=a.a.Vi,a.a.Oz||(d.align="center"),A(c,d),d=M.d.g(a.a.Jk,a.canvas.width,a.a.Ik)-a.f.x,f=M.d.g(a.a.ph,a.canvas.height,a.a.Hk)-a.f.y,b.Ri=new $g(d,f,a.a.Ik,a.a.Hk,a.depth-100,b.Eg,c,a.a.Qh,a.a.Rh,a.f,b.toString)):a.Ic(a.a.Vi,d,a.a.Jk,a.a.ph))}
function ch(a,b){var c,d,f,h;switch(b){case "totalScore":c=M.k.I("levelEndScreenTotalScore","<LEVENENDSCREENTOTALSCORE>");d=""+a.za.totalScore;f=0;break;case "timeLeft":c=M.k.I("levelEndScreenTimeLeft","<LEVENENDSCREENTIMELEFT>"),d=""+a.za.timeLeft}void 0!==c&&a.Ic(a.a.Cn,c,a.a.hr,a.a.Dn);void 0!==d&&(void 0!==f?(c=W.P(),d=a.a.Vi,d.align="center",A(c,d),d=M.d.g(a.a.Jk,a.canvas.width,a.a.Ik)-a.f.x,h=M.d.g(a.a.ph,a.canvas.height,a.a.Hk)-a.f.y,f=new $g(d,h,a.a.Ik,a.a.Hk,a.depth-100,f,c,a.a.Qh,a.a.Rh,
a.f)):a.Ic(a.a.Vi,d,a.a.Jk,a.a.ph));f instanceof $g&&("totalScore"===b?a.Tg=f:a.Yf.push(f))}e=Tg.prototype;e.Ic=function(a,b,c,d,f,h){var k=W.P();A(k,a);void 0!==f&&void 0!==h&&(a=Va(k,b,f,h,f),k.fontSize>a&&D(k,a));a=k.$(b);h=k.U(b);k.o(b,M.d.Ba(c,this.canvas.width,a,k.align)-this.f.x,M.d.Ba(d,this.canvas.height,h,k.i)-this.f.y,f)};
function dh(a,b){var c,d,f,h;switch(b){case "retry":c=ge;d=function(){a.gf="retry";Ug(a)};break;case "exit":c=de,d=function(){a.gf="exit";Ug(a)}}void 0!==c&&(f=M.d.g(a.a.Hu,a.canvas.width,c.width)-a.f.x,h=M.d.g(a.a.vq,a.canvas.height,c.height)-a.f.y,a.buttons.push(new kg(f,h,a.depth-20,new Zb(c),[c],d,a.f)))}
function eh(a,b){var c,d,f,h;switch(b){case "retry":c=pe;d=function(){a.gf="retry";Ug(a)};break;case "exit":c=ne;d=function(){a.gf="exit";Ug(a)};break;case "next":c=ne,d=function(){a.gf="next";Ug(a)}}void 0!==c&&(f=M.d.g(a.a.sv,a.canvas.width,c.width)-a.f.x,h=M.d.g(a.a.ur,a.canvas.height,c.height)-a.f.y,a.buttons.push(new kg(f,h,a.depth-20,new Zb(c),[c],d,a.f)))}
e.Vb=function(){this.m=0;this.J=[];this.Dg=[];this.buttons=[];this.canvas.W=!0;this.gf="";this.fd=this.za.failed?!0:!1;this.nd=this.Ga.nd&&!this.fd;this.Nh=this.Ga.Nh&&!this.fd&&this.za.Rr;this.Vm=this.alpha=this.hh=0;fh(this);var a,b,c,d,f,h,k=this;switch(this.Ga.nk){case "failed":this.b=this.a.Jl.$v;break;case "level":this.b=this.a.Jl.cw;break;case "difficulty":this.b=this.a.Jl.yn;break;case "endless":this.b=this.a.Jl.kv}this.f=new gh(this.depth-10,this.Qa,new r(this.b.width,this.b.height));this.f.x=
M.d.g(this.a.tc,this.canvas.width,this.b.width);this.f.y=M.d.g(this.a.Zb,this.canvas.height,this.b.height);x(this.f.b);this.b.o(0,0,0);!this.fd&&this.nd&&(b=M.d.g(this.a.qp,this.canvas.width,0)-this.f.x,a=M.d.g(this.a.rp,this.canvas.height,s_star01_fill.height)-this.f.y+Math.round(s_star01_empty.height/2),s_star01_empty.o(0,b,a),b=M.d.g(this.a.sp,this.canvas.width,0)-this.f.x,a=M.d.g(this.a.tp,this.canvas.height,s_star02_fill.height)-this.f.y+Math.round(s_star02_empty.height/2),s_star02_empty.o(0,
b,a),b=M.d.g(this.a.up,this.canvas.width,0)-this.f.x,a=M.d.g(this.a.vp,this.canvas.height,s_star03_fill.height)-this.f.y+Math.round(s_star03_empty.height/2),s_star03_empty.o(0,b,a));void 0!==this.Ga.Lj&&Xg(this,this.Ga.Lj);void 0!==this.Ga.At&&Yg(this,this.Ga.At);this.Sb={};void 0!==this.za.Vd?(c=this.za.Vd,c.visible&&bh(this,c),this.Sb[c.id]=c):void 0!==this.Ga.En&&ch(this,this.Ga.En);if(void 0!==this.za.Sb)for(a=this.za.Sb.length,b=W.P(),A(b,this.a.Gj),c=W.P(),A(c,this.a.Fg),b=Math.max(b.U("g"),
c.U("g"))*a+this.a.Id*(a-1),this.Jd=M.d.g(this.a.Gg,this.canvas.height,b)-this.f.y,b=0;b<a;b++)c=this.za.Sb[b],c.visible&&Zg(this,this.za.Sb[b],1<a),this.Sb[c.id]=c;else if(void 0!==this.Ga.Af)if("string"===typeof this.Ga.Af)ah(this,this.Ga.Af,this.a.tr);else if(this.Ga.Af instanceof Array)for(a=this.Ga.Af.length,b=W.P(),A(b,this.a.Gj),c=W.P(),A(c,this.a.Fg),b=Math.max(b.U("g"),c.U("g"))*a+this.a.Id*(a-1),this.Jd=M.d.g(this.a.Gg,this.canvas.height,b)-this.f.y,b=0;b<a;b++)ah(this,this.Ga.Af[b],1<a||
this.a.tr);y(this.f.b);dh(this,this.Ga.lk);eh(this,this.Ga.Pk);M.e.cu&&(b=M.d.g(k.a.Mv,k.canvas.width,k.a.Or)-this.f.x,a=M.d.g(this.a.Nv,this.canvas.height,this.a.cg)-this.f.y,this.Nr=new Fg("default_text",b,a,k.depth-20,"levelEndScreenViewHighscoreBtn",k.a.Or,{da:function(){void 0!==hh?M.l.Cd(M.w.el.url+"submit/"+hh+"/"+k.za.totalScore):M.l.Cd(M.w.el.url+"submit/")},qc:!0},k.f),this.buttons.push(this.Nr),b=function(a){a&&(k.Nr.Mp("levelEndScreenSubmitHighscoreBtn"),k.jA=a)},ih(this.za.totalScore,
b));b=M.d.g(this.a.Ni,this.canvas.width,this.a.jh)-this.f.x;a=M.d.g(this.a.kh,this.canvas.height,this.a.cg)-this.f.y;this.buttons.push(new kg(b,a,this.depth-20,new Xb(0,0,this.a.jh,this.a.cg),void 0,function(){k.gf="exit";Ug(k)},this.f));for(b=0;b<this.buttons.length;b++)this.buttons[b].xb=!1;this.f.y=-this.f.height;a=this.a.By;this.Ta.V(a,this.ky);a+=this.a.Ei;f=0;d=this.a.Jy;this.nd&&(d=Math.max(d,this.a.mt+this.a.lt*this.za.stars));if(this.Tg&&(this.Ta.V(a+this.a.um,function(a,b){jh(b.parent.Tg,
b.parent.za.totalScore,d)}),f=a+this.a.um+d,0<this.Yf.length)){h=function(a,b){var c=b.parent,d=c.Yf[c.hh];jh(c.Tg,c.Tg.value+d.value,c.a.gh);jh(d,0,c.a.gh);c.hh+=1};for(b=0;b<this.Yf.length;b++)f+=this.a.Fq,this.Ta.V(f,h);f+=this.a.gh}if(void 0!==this.Sb&&(f=a,h=function(a,b){var c=b.parent,d=c.yp[c.hh||0],f=c.Sb[d.hm];void 0!==d.Jf&&(f.visible&&f.df?jh(f.Ri,d.Jf(f.Ri.value),c.a.gh):f.ed=d.Jf(f.ed));d.visible&&d.df&&jh(d.Ri,d.ed,c.a.gh);c.hh+=1},this.yp=[],void 0!==this.za.Vd&&void 0!==this.za.Vd.Jf&&
(this.Ta.V(a+this.a.um,h),this.yp.push(this.za.Vd),f+=this.a.um+bonusCounterDuration),void 0!==this.za.Sb))for(b=0;b<this.za.Sb.length;b++)c=this.za.Sb[b],void 0!==c.Jf&&(f+=this.a.Fq,this.Ta.V(f,h),this.yp.push(c),f+=this.a.gh);if(this.nd){for(b=0;b<this.za.stars;b++)a+=this.a.lt,this.Ta.V(a,this.my),this.Ta.V(a,this.ny);a+=this.a.mt}a=Math.max(a,f);this.Nh&&(a+=this.a.xw,this.Ta.V(a,this.jy),this.Ta.V(a,this.hy),this.Ta.V(a+this.a.yw,this.iy));a+=500;this.Ta.V(a,function(){M.l.Sv&&M.l.Sv()});this.Ta.V(a+
this.a.Pw,M.l.Tv);M.l.Sr(this.za);this.Ta.start();this.fd?G.play(Rf):G.play(Mf)};e.Y=function(a){this.alpha=this.a.Nk*this.Vm/this.a.Ub;this.Vm+=a;this.alpha>=this.a.Nk&&(this.alpha=this.a.Nk,this.h=!1);this.canvas.W=!0};
e.ky=function(a,b){function c(){var a;for(a=0;a<d.buttons.length;a++)d.buttons[a].xb=!0}var d=b.parent,f,h;switch(d.a.az){case "fromLeft":h="horizontal";f=M.d.g(d.a.tc,d.canvas.width,d.f.width);d.f.x=-d.f.width;d.f.y=M.d.g(d.a.Zb,d.canvas.height,d.f.height)+Math.abs(M.qa);break;case "fromRight":h="horizontal";f=M.d.g(d.a.tc,d.canvas.width,d.f.width);d.f.x=d.canvas.width;d.f.y=M.d.g(this.parent.a.Zb,d.canvas.height,selft.f.height)+Math.abs(M.qa);break;case "fromBottom":h="vertical";f=M.d.g(d.a.Zb,
d.canvas.height,d.f.height)+Math.abs(M.qa);d.f.x=M.d.g(d.a.tc,d.canvas.width,d.f.width);d.f.y=d.canvas.height+d.f.height;break;default:h="vertical",f=M.d.g(d.a.Zb,d.canvas.height,d.f.height)+Math.abs(M.qa),d.f.x=M.d.g(d.a.tc,d.canvas.width,d.f.width),d.f.y=-d.f.height}"vertical"===h?kh(d.f,"y",f,d.a.Ei,d.a.Wm,c):kh(d.f,"x",f,d.a.Ei,d.a.Wm,c)};
function Wg(a){function b(){K(I,a);a.ta?a.da.call(a.ta,a.gf):a.da(a.gf)}var c,d;switch(a.a.bz){case "toLeft":d="horizontal";c=-a.f.width;break;case "toRight":d="horizontal";c=a.canvas.width;break;case "toBottom":d="vertical";c=a.canvas.height+a.f.height;break;default:d="vertical",c=-a.f.height}"vertical"===d?kh(a.f,"y",c,a.a.Xm,a.a.Ym,b):kh(a.f,"x",c,a.a.Xm,a.a.Ym,b)}
e.my=function(a,b){var c,d=b.parent,f=Math.abs(M.qa);if(d.J.length<d.za.stars){switch(d.J.length+1){case 1:c=new gh(d.depth-30,M.Fe,s_star01_fill);c.x=M.d.g(d.a.qp,d.canvas.width,0);c.y=M.d.g(d.a.rp,d.canvas.height,s_star01_fill.height)+f+Math.round(s_star01_empty.height/2);break;case 2:c=new gh(d.depth-30,M.Fe,s_star02_fill);c.x=M.d.g(d.a.sp,d.canvas.width,0);c.y=M.d.g(d.a.tp,d.canvas.height,s_star02_fill.height)+f+Math.round(s_star02_empty.height/2);break;case 3:c=new gh(d.depth-30,M.Fe,s_star03_fill),
c.x=M.d.g(d.a.up,d.canvas.width,0),c.y=M.d.g(d.a.vp,d.canvas.height,s_star03_fill.height)+f+Math.round(s_star03_empty.height/2)}c.ab=d.a.nt;c.eb=d.a.nt;c.alpha=d.a.ey;kh(c,"scale",1,d.a.dy,tc,function(){var a=d.J.length,b,c,n;x(d.f.b);switch(a){case 1:n=s_star01_fill;b=M.d.g(d.a.qp,d.canvas.width,0)-d.f.x;c=M.d.g(d.a.rp,d.canvas.height,s_star01_fill.height)-d.f.y+f+Math.round(s_star01_empty.height/2);break;case 2:n=s_star02_fill;b=M.d.g(d.a.sp,d.canvas.width,0)-d.f.x;c=M.d.g(d.a.tp,d.canvas.height,
s_star01_fill.height)-d.f.y+f+Math.round(s_star02_empty.height/2);break;case 3:n=s_star03_fill,b=M.d.g(d.a.up,d.canvas.width,0)-d.f.x,c=M.d.g(d.a.vp,d.canvas.height,s_star01_fill.height)-d.f.y+f+Math.round(s_star03_empty.height/2)}n.o(0,b,c);y(d.f.b);d.f.jd=!0;K(I,d.J[a-1])});kh(c,"alpha",1,d.a.cy,kc);d.J.push(c);G.play(d.ay[d.J.length-1])}};
e.ny=function(a,b){var c=b.parent,d,f;d=c.J[c.Dg.length];f=new gh(c.depth-50,M.Fe,s_sfx_star);f.x=d.x;f.y=d.y;kh(f,"subImage",s_sfx_star.D-1,c.a.by,void 0,function(){K(I,f)});c.Dg.push(f)};
e.hy=function(a,b){var c=b.parent,d,f,h,k,l,n,q;d=[];h=W.P();k=M.k.I("levelEndScreenMedal","<LEVELENDSCREENMEDAL>");c.a.Bs&&A(h,c.a.Bs);f=Va(h,k,c.a.tl,c.a.Ew,!0);f<h.fontSize&&D(h,f);l=M.d.Ba(c.a.Fw,Vc.width,h.$(k,c.a.tl),h.align);n=M.d.Ba(c.a.Gw,Vc.height,h.U(k,c.a.tl),h.i);for(q=0;q<Vc.D;q++)f=new r(Vc.width,Vc.height),x(f),Vc.o(q,0,0),h.o(k,l,n,c.a.tl),y(f),d.push(f);c.Ra=new gh(c.depth-120,M.Fe,d);c.Ra.Dd=c.a.ys;c.Ra.Ed=c.a.zs;c.Ra.x=M.d.g({align:"center"},c.f.canvas.width,c.Ra.width)-c.f.x;
c.Ra.y=M.d.g(c.a.ul,c.Ra.canvas.height,c.Ra.height)-c.f.y+Math.abs(M.qa);l=M.d.g(c.a.Lo,c.Ra.canvas.width,c.Ra.width)-c.f.x;c.Ra.ab=c.a.sl;c.Ra.eb=c.a.sl;c.Ra.parent=c.f;c.Ra.alpha=0;c.Ra.qz=!0;kh(c.Ra,"scale",1,c.a.Dh,kc,function(){K(I,c.zb);c.zb=void 0});kh(c.Ra,"x",l,c.a.Dh,kc);kh(c.Ra,"alpha",1,0,kc);kh(c.Ra,"subImage",Vc.D,c.a.Cw,kc,void 0,c.a.Dh+c.a.xs+c.a.Bw,!0,c.a.Dw)};
e.jy=function(a,b){var c,d=b.parent;d.zb=new gh(d.depth-110,M.Fe,Uc);d.zb.y=M.d.g(d.a.ul,d.zb.canvas.height,Uc.height)-d.f.y+d.a.Aw;d.zb.Dd=d.a.ys;d.zb.Ed=d.a.zs;d.zb.x=M.d.g(d.a.Lo,d.zb.canvas.width,d.zb.width)-d.f.x;c=M.d.g(d.a.ul,d.zb.canvas.height,Uc.height)-d.f.y+Math.abs(M.qa);d.zb.ab=d.a.sl*d.a.As;d.zb.eb=d.a.sl*d.a.As;d.zb.alpha=0;d.zb.parent=d.f;kh(d.zb,"y",c,d.a.Dh,kc);kh(d.zb,"scale",1,d.a.Dh,kc);kh(d.zb,"alpha",1,d.a.Dh,kc)};
e.iy=function(a,b){var c=b.parent;c.rf=new gh(c.depth-130,M.Fe,Tc);c.rf.parent=c.f;c.rf.x=c.Ra.x;c.rf.y=c.Ra.y+c.a.zw;kh(c.rf,"subImage",Tc.D-1,c.a.xs,void 0,function(){K(I,c.rf);c.rf=void 0});G.play(Uf)};
e.jb=function(){var a;for(a=0;a<this.buttons.length;a++)K(I,this.buttons[a]);for(a=0;a<this.J.length;a++)K(I,this.J[a]);for(a=0;a<this.Dg.length;a++)K(I,this.Dg[a]);this.Ra&&(K(I,this.Ra),this.rf&&K(I,this.rf),this.zb&&K(I,this.zb));K(I,this.f);this.Ta&&this.Ta.stop();this.Tg&&K(I,this.Tg);for(a=0;a<this.Yf.length;a++)K(I,this.Yf[a]);lh()};e.ya=function(){var a=m.context.globalAlpha;m.context.globalAlpha=this.alpha;sa(0,0,m.canvas.width,m.canvas.height,this.a.mr,!1);m.context.globalAlpha=a};
function mh(a,b,c,d){this.depth=-100;this.visible=!1;this.h=!0;M.d.Ja(this,M.Cc);var f,h;this.a=c?M.a.u.Js:M.a.u.options;if("landscape"===M.orientation)for(f in h=c?M.a.u.RA:M.a.u.cx,h)this.a[f]=h[f];this.Ac=M.a.u.mc;h=c?M.a.R.Js:M.a.R.options;for(f in h)this.a[f]=h[f];if(M.w.options&&M.w.options.buttons)for(f in M.w.options.buttons)this.a.buttons[f]=M.w.options.buttons[f];this.type=a;this.Ly=b;this.wd=c;this.cm=!1!==d;J(this)}e=mh.prototype;
e.Di=function(a,b,c,d,f){var h=void 0,k=void 0,l=void 0,n=void 0,q=void 0,u=void 0;switch(a){case "music":h="music_toggle";n=this.Ut;l=M.e.yg()?"on":"off";break;case "music_big":h="music_big_toggle";n=this.Ut;l=M.e.yg()?"on":"off";break;case "sfx_big":h="sfx_big_toggle";n=this.Vt;l=M.e.Ql()?"on":"off";break;case "sfx":h="sfx_toggle";n=this.Vt;l=M.e.Ql()?"on":"off";break;case "language":h="language_toggle";n=this.Tt;l=M.e.language();break;case "tutorial":h="default_text";k="optionsTutorial";n=this.Dj;
break;case "highScores":h="default_text";k="optionsHighScore";n=this.Xs;this.kn=this.Rx;break;case "moreGames":void 0!==M.w.Ow?(h="default_image",u=M.w.Ow):(h="default_text",k="optionsMoreGames");n=this.Sx;q=!0;break;case "resume":h="default_text";k="optionsResume";n=this.close;break;case "exit":h="default_text";k="optionsExit";n=M.Jh.customFunctions&&"function"===typeof M.Jh.customFunctions.exit?M.Jh.customFunctions.exit:function(){};break;case "quit":h="default_text";k="optionsQuit";n=this.Cx;break;
case "restart":h="default_text";k="optionsRestart";n=this.Gx;break;case "startScreen":h="default_text";k="optionsStartScreen";n=this.Xs;this.kn=this.Ux;break;case "about":h="default_text";k="optionsAbout";n=this.Ox;break;case "forfeitChallenge":h="default_text";k="optionsChallengeForfeit";n=this.$i;break;case "cancelChallenge":h="default_text",k="optionsChallengeCancel",n=this.Li}void 0!==h&&void 0!==n&&("image"===this.Ac[h].type?this.buttons.push(new nh(h,b,c,this.depth-20,u,d,{da:n,ta:this,qc:q},
this.f)):"toggleText"===this.Ac[h].type?this.buttons.push(new Bg(h,b,c,this.depth-20,l,d,{da:n,ta:this,qc:q},this.f)):"text"===this.Ac[h].type?this.buttons.push(new Fg(h,b,c,this.depth-20,k,d,{da:n,ta:this,qc:q},this.f)):"toggle"===this.Ac[h].type&&this.buttons.push(new oh(h,b,c,this.depth-20,l,{da:n,ta:this,qc:q},this.f)),this.buttons[this.buttons.length-1].xb=f||!1)};
e.Xs=function(){var a=this;kh(a.f,"y","inGame"!==this.type?-this.f.b.height:this.canvas.height,this.a.Gl,this.a.Hl,function(){K(I,a);void 0!==a.kn&&a.kn.call(a)});return!0};
e.Pa=function(a,b){var c,d,f,h;x(this.f.b);m.clear();this.a.backgroundImage.o(0,0,0);c=M.k.I("optionsTitle","<OPTIONS_TITLE>");d=W.P();this.a.sd&&A(d,this.a.sd);void 0!==this.a.de&&void 0!==this.a.Gf&&(f=Va(d,c,this.a.de,this.a.Gf,this.a.de),d.fontSize>f&&D(d,f));f=M.d.Ba(this.a.Qg,this.canvas.width,d.$(c),d.align)-a;h=M.d.Ba(this.a.Kd,this.canvas.height,d.U(c,d.i))-b+-1*M.qa;d.o(c,f,h);y(this.f.b)};
e.Sf=function(a,b,c){var d,f,h,k,l,n,q;h=!1;var u=this.a.buttons[this.type];"inGame"===this.type&&M.a.j.jg.Jw&&(u=M.a.j.jg.Jw);if("function"!==typeof ph())for(d=0;d<u.length;d++){if("string"===typeof u[d]&&"moreGames"===u[d]){u.splice(d,1);break}for(f=0;f<u[d].length;f++)if("moreGames"===u[d][f]){u[d].splice(f,1);break}}if(!1===M.w.yg||!1===M.e.nl)for(d=0;d<u.length;d++)if(u[d]instanceof Array){for(f=0;f<u[d].length;f++)if("music"===u[d][f]){M.e.ol?u[d]="sfx_big":u.splice(d,1);h=!0;break}if(h)break}else if("music_big"===
u[d]){u.splice(d,1);break}if(!M.e.ol)for(d=0;d<u.length;d++)if(u[d]instanceof Array){for(f=0;f<u[d].length;f++)if("sfx"===u[d][f]){!1!==M.w.yg&&M.e.nl?u[d]="music_big":u.splice(d,1);h=!0;break}if(h)break}else if("sfx_big"===u[d]){u.splice(d,1);break}if(1===M.k.zv().length)for(d=0;d<u.length;d++)if("language"===u[d]){u.splice(d,1);break}h=this.Ac.default_text.q.height;k=this.a.uk;a=M.d.g(this.a.tk,this.canvas.width,k)-a;n=M.d.g(this.a.Ji,this.f.b.height,h*u.length+this.a.Qd*(u.length-1))-b+-1*M.qa;
for(d=0;d<u.length;d++){l=a;q=k;if("string"===typeof u[d])this.Di(u[d],l,n,q,c);else for(b=u[d],q=(k-(b.length-1)*this.a.Qd)/b.length,f=0;f<b.length;f++)this.Di(b[f],l,n,q,c),l+=q+this.a.Qd;n+=h+this.a.Qd}};e.Ut=function(a){var b=!0;"off"===a?(b=!1,M.La.cb("off","options:music")):M.La.cb("on","options:music");M.e.yg(b);return!0};e.Vt=function(a){var b=!0;"off"===a?(b=!1,M.La.cb("off","options:sfx")):M.La.cb("on","options:sfx");M.e.Ql(b);return!0};
e.Tt=function(a){M.k.Zs(a);M.La.cb(a,"options:language");return!0};
e.Dj=function(){function a(){l.Rc+=1;l.Dj();return!0}function b(){l.Rc-=1;l.Dj();return!0}function c(){var a;l.Pa(n,q);l.bg.xb=!0;for(a=0;a<l.buttons.length;a++)K(I,l.buttons[a]);l.buttons=[];l.Sf(n,q,!0)}var d,f,h,k,l=this,n=M.d.g(l.a.tc,l.canvas.width,l.a.backgroundImage.width),q=M.d.g(l.a.Zb,l.canvas.height,l.a.backgroundImage.height)+-1*M.qa;void 0===l.Rc&&(l.Rc=0);l.Nj=void 0!==M.j.ho?M.j.ho(M.e.vb,Cg()):[];M.La.cb((10>l.Rc?"0":"")+l.Rc,"options:tutorial");for(d=0;d<l.buttons.length;d++)K(I,
l.buttons[d]);l.buttons=[];this.wd?(x(l.f.b),m.clear(),l.bg.xb=!1):l.Pa(n,q);x(l.f.b);void 0!==l.a.Ld&&(d=M.d.g(l.a.xm,l.f.b.width,l.a.Ld.width),f=M.d.g(l.a.If,l.f.b.height,l.a.Ld.height),l.a.Ld.o(0,d,f));k=l.Nj[l.Rc].title;void 0!==k&&""!==k&&(h=W.P(),l.a.zm&&A(h,l.a.zm),d=Va(h,k,l.a.Am,l.a.Jp,l.a.Am),h.fontSize>d&&D(h,d),d=M.d.Ba(l.a.bu,l.f.b.width,h.$(k,l.a.Am),h.align),f=M.d.Ba(l.a.Kp,l.f.b.height,h.U(k,l.a.Jp),h.i),h.o(k,d,f));l.Rc<l.Nj.length&&(h=l.Nj[l.Rc].b,d=M.d.g(l.a.Zt,l.f.b.width,h.width),
f=M.d.g(l.a.Hp,l.f.b.height,h.height),h.o(0,d,f),k=l.Nj[l.Rc].text,h=W.P(),l.a.ym&&A(h,l.a.ym),d=Va(h,k,l.a.Yh,l.a.$t,l.a.Yh),h.fontSize>d&&D(h,d),d=M.d.Ba(l.a.au,l.f.b.width,h.$(k,l.a.Yh),h.align),f=M.d.Ba(l.a.Ip,l.f.b.height,h.U(k,l.a.Yh),h.i),h.o(k,d,f,l.a.Yh));y(l.f.b);h=nd;d=M.d.g(l.a.Yt,l.canvas.width,h.width)-l.f.x;f=M.d.g(l.a.Gp,l.canvas.height,h.height)-l.f.y-M.qa;0<=l.Rc-1?l.buttons.push(new kg(d,f,l.depth-20,new Zb(h),[h],{da:b,ta:l},l.f)):(h=ld,l.buttons.push(new kg(d,f,l.depth-20,new Zb(h),
[h],{da:c,ta:l},l.f)));h=md;d=M.d.g(this.a.Xt,l.canvas.width,h.width)-l.f.x;f=M.d.g(this.a.Fp,l.canvas.height,h.height)-l.f.y-M.qa;l.Rc+1<l.Nj.length?l.buttons.push(new kg(d,f,l.depth-20,new Zb(h),[h],{da:a,ta:l},l.f)):(h=ld,l.buttons.push(new kg(d,f,l.depth-20,new Zb(h),[h],{da:c,ta:l},l.f)));return!0};
e.Ox=function(){function a(a,b,c,f,h,k){var l;l=W.P();b&&A(l,b);b=Va(l,a,h,k,h);l.fontSize>b&&D(l,b);c=M.d.Ba(c,d.f.b.width,l.$(a,h),l.align);f=M.d.Ba(f,d.f.b.height,l.U(a,k),l.i);l.o(a,c,f,h);return f+k}function b(a,b,c){b=M.d.g(b,d.f.b.width,a.width);c=M.d.g(c,d.f.b.height,a.height);a.o(0,b,c);return c+a.height}var c,d=this,f=M.d.g(d.a.tc,d.canvas.width,d.a.backgroundImage.width),h=M.d.g(d.a.Zb,d.canvas.height,d.a.backgroundImage.height)+-1*M.qa;M.La.cb("about","options");for(c=0;c<d.buttons.length;c++)K(I,
d.buttons[c]);d.buttons=[];this.wd?(x(d.f.b),m.clear(),d.bg.xb=!1):d.Pa(f,h);x(d.f.b);void 0!==d.a.Ld&&b(d.a.Ld,d.a.xm,d.a.If);var k=null;"function"===typeof M.l.cr?k=M.l.cr(d.a,a,b,d.f.b):(c=M.k.I("optionsAbout_header","<OPTIONSABOUT_HEADER>"),a(c,d.a.ek,d.a.gk,d.a.xi,d.a.fk,d.a.jq),b(pd,d.a.yi,d.a.hk),c=M.k.I("optionsAbout_text","<OPTIONSABOUT_TEXT>"),a(c,d.a.zi,d.a.ah,d.a.Bi,d.a.Rf,d.a.Ai));a(M.k.I("optionsAbout_version","<OPTIONSABOUT_VERSION>")+" "+qg()+("big"===M.size?"b":"s"),d.a.Rm,d.a.mq,
d.a.Sm,d.a.lq,d.a.kq);y(d.f.b);if(k)for(c=0;c<k.length;++c){var l=k[c];d.buttons.push(new kg(l.x,l.y,d.depth-10,Xb(0,0,l.width,l.height),null,{da:function(a){return function(){M.l.Cd(a)}}(l.url),qc:!0},d.f))}else void 0!==M.w.Qr&&(c=M.d.g(d.a.yi,d.f.b.width,pd.width),k=M.d.g(d.a.hk,d.f.b.height,pd.height),c=Math.min(c,M.d.g(d.a.ah,d.f.b.width,d.a.Rf)),k=Math.min(k,M.d.g(d.a.Bi,d.f.b.height,d.a.Ai)),l=Math.max(d.a.Rf,pd.width),d.buttons.push(new kg(c,k,d.depth-10,Xb(0,0,l,M.d.g(d.a.Bi,d.f.b.height,
d.a.Ai)+d.a.Ai-k),null,{da:function(){M.l.Cd(M.w.Qr)},qc:!0},d.f)));d.buttons.push(new Fg("default_text",M.d.g(d.a.Qm,d.f.b.width,d.a.wi),d.a.vi,d.depth-20,"optionsAbout_backBtn",d.a.wi,{da:function(){var a;d.Pa(f,h);d.bg.xb=!0;for(a=0;a<d.buttons.length;a++)K(I,d.buttons[a]);d.buttons=[];d.Sf(f,h,!0);d.ft=!1},ta:d},d.f));return this.ft=!0};
function qh(a){var b,c,d,f,h,k=M.d.g(a.a.tc,a.canvas.width,a.a.backgroundImage.width),l=M.d.g(a.a.Zb,a.canvas.height,a.a.backgroundImage.height)+-1*M.qa;M.La.cb("versions","options");for(b=0;b<a.buttons.length;b++)K(I,a.buttons[b]);a.buttons=[];a.Pa(k,l);x(a.f.b);void 0!==a.a.Ld&&a.a.Ld.o(0,M.d.g(a.a.xm,a.f.width,a.a.Ld.width),M.d.g(a.a.If,a.f.height,a.a.Ld.height));h=W.P();A(h,a.a.Rm);E(h,"left");c=a.a.lu;d=a.a.mu;for(b in M.version)f=b+": "+M.version[b],h.o(f,c,d),d+=h.U(f)+a.a.ku;c=M.d.g(a.a.Qm,
a.f.b.width,a.a.wi);d=a.a.vi;a.buttons.push(new Fg("default_text",c,d,a.depth-20,"optionsAbout_backBtn",a.a.wi,{da:function(){var b;a.Pa(k,l);for(b=0;b<a.buttons.length;b++)K(I,a.buttons[b]);a.buttons=[];a.Sf(k,l,!0)},ta:a},a.f))}e.Rx=function(){return!0};e.Sx=function(){M.La.cb("moreGames","options");var a=ph();"function"===typeof a&&a();return!0};
e.Cx=function(){var a=this;rh(this,"optionsQuitConfirmationText","optionsQuitConfirmBtn_Yes","optionsQuitConfirmBtn_No",function(){M.La.cb("confirm_yes","options:quit");K(I,a);rg(M.La,M.e.Og,sh(M.e),"progression:levelQuit:"+th());uh();vh(M.e);return!0})};
e.Gx=function(){var a=this;rh(this,"optionsRestartConfirmationText","optionsQuitConfirmBtn_Yes","optionsQuitConfirmBtn_No",function(){M.La.cb("confirm_yes","options:restart");K(I,a);var b=M.e;b.state="LEVEL_END";rg(M.La,M.e.Og,sh(M.e),"progression:levelRestart:"+th());b=M.n.Pj?b.vb+1:Mg(b)+1;M.e.ua=!0;M.e.bs="retry";wh(M.e,!0);b={failed:!0,level:b,restart:!0};M.l.zh(b);M.Od.zh(b);return!0})};
e.$i=function(){var a,b=this;a=function(a){var d=a?"challengeForfeitMessage_success":"challengeForfeitMessage_error";xh(b,M.k.I(d,"<"+d.toUpperCase()+">"));a&&(b.bg.xb=!1,b.cm||fh())};rh(this,"challengeForfeitConfirmText","challengeForfeitConfirmBtn_yes","challengeForfeitConfirmBtn_no",function(){M.e.$i(a);return!0})};
e.Li=function(){var a,b=this;a=function(a){var d=a?"challengeCancelMessage_success":"challengeCancel_error";xh(b,M.k.I(d,"<"+d.toUpperCase()+">"));a&&(b.bg.xb=!1,b.cm||fh())};rh(this,"challengeCancelConfirmText","challengeCancelConfirmBtn_yes","challengeCancelConfirmBtn_no",function(){M.e.Li(a);return!0})};
function rh(a,b,c,d,f){var h,k,l,n;for(h=0;h<a.buttons.length;h++)K(I,a.buttons[h]);a.buttons=[];b=M.k.I(b,"<"+b.toUpperCase()+">");h=W.P();a.a.Sq?A(h,a.a.Sq):a.a.Ul&&A(h,a.a.Ul);k=Va(h,b,a.a.xk,a.a.sn,!0);k<h.fontSize&&D(h,k);n=h.$(b,a.a.xk)+10;l=h.U(b,a.a.xk)+10;k=M.d.Ba(a.a.Tq,a.f.b.width,n,h.align);l=M.d.Ba(a.a.tn,a.f.b.height,l,h.i);x(a.f.b);h.o(b,k,l,n);y(a.f.b);k=M.d.g(a.a.Qq,a.canvas.width,a.a.Pi)-a.f.x;l=M.d.g(a.a.qn,a.canvas.height,a.Ac.default_text.q.height)-a.f.y-M.qa;a.buttons.push(new Fg("default_text",
k,l,a.depth-20,d,a.a.Pi,{da:function(){var b,c,d;c=M.d.g(a.a.tc,a.canvas.width,a.a.backgroundImage.width);d=M.d.g(a.a.Zb,a.canvas.height,a.a.backgroundImage.height)+-1*M.qa;a.Pa(c,d);for(b=0;b<a.buttons.length;b++)K(I,a.buttons[b]);a.buttons=[];a.Sf(c,d,!0);return!0},ta:a},a.f));k=M.d.g(a.a.Rq,a.canvas.width,a.a.Pi)-a.f.x;l=M.d.g(a.a.rn,a.canvas.height,a.Ac.default_text.q.height)-a.f.y-M.qa;a.buttons.push(new Fg("default_text",k,l,a.depth-20,c,a.a.Pi,{da:function(){return"function"===typeof f?f():
!0},ta:a},a.f))}function xh(a,b){var c,d,f,h;for(c=0;c<a.buttons.length;c++)K(I,a.buttons[c]);a.buttons=[];d=M.d.g(a.a.tc,a.canvas.width,a.a.backgroundImage.width);f=M.d.g(a.a.Zb,a.canvas.height,a.a.backgroundImage.height)+-1*M.qa;a.Pa(d,f);c=W.P();a.a.Oo&&A(c,a.a.Oo);d=Va(c,b,a.a.Po,a.a.Kw,!0);d<c.fontSize&&D(c,d);h=c.$(b,a.a.Po)+10;f=c.U(b,a.a.Po)+10;d=M.d.Ba(a.a.Lw,a.f.b.width,h,c.align);f=M.d.Ba(a.a.Mw,a.f.b.height,f,c.i);x(a.f.b);c.o(b,d,f,h);y(a.f.b)}
e.Ux=function(){M.La.cb("startScreen","options");vh(M.e);return!0};e.close=function(){K(I,this);return this.canvas.W=!0};
e.Vb=function(){var a,b;this.cm&&fh(this);M.e.ke=this;this.qr=this.pr=!1;a=this.a.backgroundImage;this.f=new gh(this.depth-10,this.Qa,new r(a.width,a.height));this.f.x=M.d.g(this.a.tc,this.canvas.width,a.width);a=M.d.g(this.a.Zb,this.canvas.height,a.height)+-1*M.qa;this.f.y=a;this.Pa(this.f.x,this.f.y);this.buttons=[];this.Ly?this.Dj():this.Sf(this.f.x,this.f.y);this.bg=new kg(this.a.Ni,this.a.kh,this.depth-20,new Xb(0,0,this.a.jh,this.a.cg),void 0,{da:this.close,ta:this},this.f);this.$h="versions";
this.Uf=new fc;M.d.Ja(this.Uf,M.Cc);Qb(this.Uf,this.depth-1);gc(this.Uf,"keyAreaLeft",this.f.x,this.f.y+this.a.If,this.a.bh,this.a.ik,76);gc(this.Uf,"keyAreaRight",this.f.x+this.f.width-this.a.bh,this.f.y+this.a.If,this.a.bh,this.a.ik,82);gc(this.Uf,"keyAreaCentre",M.pw/2-this.a.bh/2,this.f.y+this.a.If,this.a.bh,this.a.ik,67);b=this;this.f.y="inGame"!==this.type?this.canvas.height:-this.f.b.height;kh(this.f,"y",a,this.a.uj,this.a.vj,function(){var a;for(a=0;a<b.buttons.length;a++)b.buttons[a].xb=
!0})};e.jb=function(){var a;this.cm&&lh();this.pr&&na(M.of,M.k.co());this.qr&&na(M.xf);for(a=0;a<this.buttons.length;a++)K(I,this.buttons[a]);this.Uf.clear();K(I,this.Uf);K(I,this.bg);K(I,this.f);M.e.ke=null};e.Pb=function(){return!0};e.Ob=function(){return!0};e.pg=function(a){this.ft&&(67===a?this.$h="":76===a?this.$h+="l":82===a&&(this.$h+="r"),"lrl"===this.$h&&qh(this))};e.Kc=function(a){a===M.of?(this.Pa(this.f.x,this.f.y),this.pr=!0):a===M.xf?this.qr=!0:a===M.Gu&&this.close()};
function yh(){this.depth=-200;this.h=this.visible=!0;M.d.Ja(this,M.kg);var a;this.a=M.a.u.Qk;if("landscape"===M.orientation&&M.a.u.Sn)for(a in M.a.u.Sn)this.a[a]=M.a.u.Sn[a];this.Ac=M.a.u.mc;for(a in M.a.R.Qk)this.a[a]=M.a.R.Qk[a];J(this)}
yh.prototype.Pa=function(){var a,b,c,d;c=this.a.backgroundImage;d=(M.mw-Math.abs(M.qa))/c.lh;this.f.b=new r(d*c.Oi,d*c.lh);x(this.f.b);this.f.y=Math.abs(M.qa);a=m.context;1E-4>Math.abs(d)||1E-4>Math.abs(d)||(a.save(),a.translate(0,0),a.rotate(-0*Math.PI/180),a.scale(d,d),a.globalAlpha=1,wa(c,0,0),a.restore());c=W.P();A(c,this.a.font);d=M.k.I("gameEndScreenTitle","<GAMEENDSCREENTITLE>");a=Va(c,d,this.a.nm-(c.stroke?c.pd:0),this.a.Ay-(c.stroke?c.pd:0),!0);a<c.fontSize&&D(c,a);a=M.d.Ba(this.a.Lt,this.canvas.width,
c.$(d),c.align);b=M.d.Ba(this.a.Mt,this.canvas.height,c.U(d),c.i);c.o(d,a,b,this.a.nm);y(this.f.b);this.f.canvas.W=!0};yh.prototype.Vb=function(){var a=this,b=this.a.backgroundImage,b=new r(b.width,b.height);this.f=new gh(this.depth,M.Cc,b);this.f.x=0;this.f.y=Math.abs(M.qa);this.Pa();this.button=new Fg(this.a.Iq,M.d.g(this.a.Ru,this.canvas.width,this.a.Jq),M.d.g(this.a.Kq,this.canvas.height,this.Ac[this.a.Iq].q.height),this.depth-10,"gameEndScreenBtnText",this.a.Jq,function(){K(I,a);vh(M.e)},this.f)};
yh.prototype.jb=function(){K(I,this.f);K(I,this.button)};yh.prototype.Kc=function(a){a!==M.of&&a!==M.xf||this.Pa()};
function kg(a,b,c,d,f,h,k){function l(a,b,c){var d,f;f=M.d.bo(q.canvas);a=Math.round(q.x+q.parent.x-q.Dd*q.ab);d=Math.round(q.y+q.parent.y-q.Ed*q.eb);if(q.images&&0<q.qg||0<q.Hj)q.qg=0,q.Hj=0,q.canvas.W=!0;if(q.zj&&q.xb&&dc(q.kb,a,d,b-f.x,c-f.y))return q.zj=!1,void 0!==q.ta?q.Fl.call(q.ta,q):q.Fl(q)}function n(a,b,c){var d,f,h;h=M.d.bo(q.canvas);d=Math.round(q.x+q.parent.x-q.Dd*q.ab);f=Math.round(q.y+q.parent.y-q.Ed*q.eb);if(q.xb&&dc(q.kb,d,f,b-h.x,c-h.y))return q.zj=!0,q.images&&(1<q.images.length?
(q.qg=1,q.canvas.W=!0):1<q.images[0].D&&(q.Hj=1,q.canvas.W=!0)),void 0!==typeof Nf&&G.play(Nf),q.ig=a,!0}this.depth=c;this.h=this.visible=!0;this.group="PG_Token";M.d.Ja(this,M.Cc);this.Ed=this.Dd=0;this.x=a;this.y=b;this.width=f?f[0].width:d.Ma-d.aa;this.height=f?f[0].height:d.qb-d.sa;this.alpha=this.eb=this.ab=1;this.na=0;this.kb=d;this.images=f;this.Hj=this.qg=0;this.zj=!1;this.xb=!0;this.parent=void 0!==k?k:{x:0,y:0};this.Zl=this.Yl=0;this.jd=!0;this.Fl=function(){};this.qc=!1;"object"===typeof h?
(this.Fl=h.da,this.ta=h.ta,this.qc=h.qc):"function"===typeof h&&(this.Fl=h);var q=this;this.qc?(this.xh=n,this.yh=l):(this.Ob=n,this.Pb=l);J(this)}function Eg(a,b,c,d,f,h){void 0===a.oa&&(a.oa=[]);a.oa.push({type:b,start:d,ad:f,hb:c,duration:h,m:0})}
function Jg(a){var b,c;if(void 0!==a.oa){for(b=0;b<a.oa.length;b++)if(c=a.oa[b],c.h){switch(c.type){case "xScale":a.ab=c.start+c.ad;break;case "yScale":a.eb=c.start+c.ad;break;case "alpha":a.alpha=c.start+c.ad;break;case "angle":a.na=c.start+c.ad;break;case "x":a.x=c.start+c.ad;break;case "y":a.y=c.start+c.ad}c.h=!1}a.canvas.W=!0}}function Qg(a,b){a.images=b;a.canvas.W=!0}e=kg.prototype;e.at=function(a){this.visible=this.h=a};e.jb=function(){this.images&&(this.canvas.W=!0)};
e.Y=function(a){var b,c;if(void 0!==this.oa){for(b=0;b<this.oa.length;b++)switch(c=this.oa[b],c.m+=a,c.type){case "xScale":var d=this.ab,f=this.Yl;this.ab=c.hb(c.m,c.start,c.ad,c.duration);this.Yl=-(this.images[0].width*this.ab-this.images[0].width*c.start)/2;if(isNaN(this.ab)||isNaN(this.Yl))this.ab=d,this.Yl=f;break;case "yScale":d=this.eb;f=this.Zl;this.eb=c.hb(c.m,c.start,c.ad,c.duration);this.Zl=-(this.images[0].height*this.eb-this.images[0].height*c.start)/2;if(isNaN(this.eb)||isNaN(this.Zl))this.eb=
d,this.Zl=f;break;case "alpha":this.alpha=c.hb(c.m,c.start,c.ad,c.duration);break;case "angle":this.na=c.hb(c.m,c.start,c.ad,c.duration);break;case "x":d=this.x;this.x=c.hb(c.m,c.start,c.ad,c.duration);isNaN(this.x)&&(this.x=d);break;case "y":d=this.y,this.y=c.hb(c.m,c.start,c.ad,c.duration),isNaN(this.y)&&(this.y=d)}this.canvas.W=!0}};
e.Ge=function(){var a,b,c;c=M.d.bo(this.canvas);a=Math.round(this.x+this.parent.x-this.Dd*this.ab);b=Math.round(this.y+this.parent.y-this.Ed*this.eb);this.zj&&!dc(this.kb,a,b,I.ha[this.ig].x-c.x,I.ha[this.ig].y-c.y)&&(this.images&&(this.Hj=this.qg=0,this.canvas.W=!0),this.zj=!1)};
e.ya=function(){var a,b;a=Math.round(this.x+this.parent.x-this.Dd*this.ab);b=Math.round(this.y+this.parent.y-this.Ed*this.eb);this.images&&(this.images[this.qg]instanceof r?this.images[this.qg].S(a,b,this.ab,this.eb,this.na,this.alpha):this.images[this.qg].S(this.Hj,a,b,this.ab,this.eb,this.na,this.alpha));this.jd=!1};
function Fg(a,b,c,d,f,h,k,l){this.ea=M.a.u.mc[a];a=void 0!==M.a.R.buttons?M.a.u.sk[M.a.R.buttons[a]||M.a.R.buttons.default_color]:M.a.u.sk[M.a.u.buttons.default_color];this.font=W.P();a.font&&A(this.font,a.font);this.ea.fontSize&&D(this.font,this.ea.fontSize);this.T=f;this.text=M.k.I(this.T,"<"+f.toUpperCase()+">");void 0!==h&&(this.width=h);this.height=this.ea.q.height;this.b={source:this.ea.q,Da:this.ea.Da,Bb:this.ea.Bb};f=this.ze(this.b);h=new Xb(0,0,f[0].width,f[0].height);kg.call(this,b,c,d,
h,f,k,l)}M.d.mj(Fg);e=Fg.prototype;e.Wl=function(a){this.text=M.k.I(this.T,"<"+this.T.toUpperCase()+">");a&&A(this.font,a);Qg(this,this.ze(this.b))};e.Mp=function(a,b){this.T=a;this.Wl(b)};e.Oj=function(a,b,c){"string"===typeof b&&(this.text=b);c&&A(this.font,c);a instanceof p?this.b.source=a:void 0!==a.Da&&void 0!==a.Bb&&void 0!==a.source&&(this.b=a);Qg(this,this.ze(this.b))};
e.ze=function(a){var b,c,d,f,h,k,l=a.Da+a.Bb;d=this.height-(this.ea.rd||0);var n=a.source;c=this.font.$(this.text);void 0===this.width?b=c:"number"===typeof this.width?b=this.width-l:"object"===typeof this.width&&(void 0!==this.width.width?b=this.width.width-l:(void 0!==this.width.minWidth&&(b=Math.max(this.width.minWidth-l,c)),void 0!==this.width.maxWidth&&(b=Math.min(this.width.maxWidth-l,c))));c=Va(this.font,this.text,b,d,!0);c<this.ea.fontSize?D(this.font,c):D(this.font,this.ea.fontSize);c=a.Da;
d=this.font.align;"center"===d?c+=Math.round(b/2):"right"===d&&(c+=b);d=Math.round(this.height/2);void 0!==this.ea.qd&&(d+=this.ea.qd);h=[];for(f=0;f<n.D;f++)k=new r(b+l,this.height),x(k),n.Ca(f,0,0,a.Da,this.height,0,0,1),n.Ek(f,a.Da,0,n.width-l,this.height,a.Da,0,b,this.height,1),n.Ca(f,a.Da+n.width-l,0,a.Bb,this.height,a.Da+b,0,1),this.font.o(this.text,c,d,b),y(k),h.push(k);return h};e.Kc=function(a){a===M.of&&this.Wl()};
function nh(a,b,c,d,f,h,k,l){this.ea=M.a.u.mc[a];void 0!==h&&(this.width=h);this.height=this.ea.q.height;this.Pd={source:this.ea.q,Da:this.ea.Da,Bb:this.ea.Bb};this.b=f;a=this.ze();f=new Xb(0,0,a[0].width,a[0].height);kg.call(this,b,c,d,f,a,k,l)}M.d.mj(nh);
nh.prototype.ze=function(){var a,b,c,d,f,h,k,l=this.Pd.Da+this.Pd.Bb;b=this.height-(this.ea.rd||0);var n=this.Pd.source;void 0===this.width?a=this.b.width:"number"===typeof this.width?a=this.width-l:"object"===typeof this.width&&(void 0!==this.width.width?a=this.width.width-l:(void 0!==this.width.minWidth&&(a=Math.max(this.width.minWidth-l,this.b.width)),void 0!==this.width.maxWidth&&(a=Math.min(this.width.maxWidth-l,this.b.width))));k=Math.min(a/this.b.width,b/this.b.height);k=Math.min(k,1);f=Math.round(this.Pd.Da+
(a-this.b.width*k)/2);h=Math.round((b-this.b.height*k)/2);c=[];for(b=0;b<n.D;b++){d=new r(a+l,this.height);x(d);n.Ca(b,0,0,this.Pd.Da,this.height,0,0,1);n.Ek(b,this.Pd.Da,0,n.width-l,this.height,this.Pd.Da,0,a,this.height,1);n.Ca(b,this.Pd.Da+n.width-l,0,this.Pd.Bb,this.height,this.Pd.Da+a,0,1);try{m.context.drawImage(this.b,f,h,this.b.width*k,this.b.height*k)}catch(q){}y(d);c.push(d)}return c};M.d.mj(function(a,b,c,d,f,h,k){kg.call(this,a,b,c,f,d,h,k)});
function Bg(a,b,c,d,f,h,k,l){var n;this.ea=M.a.u.mc[a];a=void 0!==M.a.R.buttons?M.a.u.sk[M.a.R.buttons[a]||M.a.R.buttons.default_color]:M.a.u.sk[M.a.u.buttons.default_color];this.font=W.P();a.font&&A(this.font,a.font);this.ea.fontSize&&D(this.font,this.ea.fontSize);void 0!==h&&(this.width=h);this.height=this.ea.q.height;this.Z=this.ea.Z;if(this.Z.length){for(h=0;h<this.Z.length;h++)if(this.Z[h].id===f){this.Oa=h;break}void 0===this.Oa&&(this.Oa=0);this.text=M.k.I(this.Z[this.Oa].T,"<"+this.Z[this.Oa].id.toUpperCase()+
">");this.Rg=this.Z[this.Oa].q;h=this.ze();a=new Xb(0,0,h[0].width,h[0].height);n=this;"function"===typeof k?f=function(){n.Cg();return k(n.Z[n.Oa].id)}:"object"===typeof k?(f={},f.qc=k.qc,f.ta=this,f.da=function(){n.Cg();return k.da.call(k.ta,n.Z[n.Oa].id)}):f=function(){n.Cg()};kg.call(this,b,c,d,a,h,f,l)}}M.d.mj(Bg);e=Bg.prototype;
e.Cg=function(a){var b;if(void 0===a)this.Oa=(this.Oa+1)%this.Z.length;else for(b=0;b<this.Z.length;b++)if(this.Z[b].id===a){this.Oa=b;break}this.Oj(this.Z[this.Oa].q,M.k.I(this.Z[this.Oa].T,"<"+this.Z[this.Oa].id.toUpperCase()+">"))};e.Wl=function(a){a&&A(this.font,a);this.text=M.k.I(this.Z[this.Oa].T,"<"+this.Z[this.Oa].id.toUpperCase()+">");Qg(this,this.ze())};e.Oj=function(a,b,c){this.text=b;this.Rg=a;c&&A(this.font,c);Qg(this,this.ze())};
e.ze=function(){var a,b,c,d,f,h,k=this.ea.Da,l=this.ea.Bb,n=k+l;f=Math.abs(k-l);d=this.height-(this.ea.rd||0);var q=this.ea.q,u=this.font.P();b=u.$(this.text);void 0===this.width?a=b:"number"===typeof this.width?a=this.width-n:"object"===typeof this.width&&(void 0!==this.width.width?a=this.width.width-n:(void 0!==this.width.minWidth&&(a=Math.max(this.width.minWidth-n,b)),void 0!==this.width.maxWidth&&(a=Math.min(this.width.maxWidth-n,b))));d=Va(u,this.text,a,d,!0);d<u.fontSize&&D(u,d);b=u.$(this.text,
a);d=k;c=u.align;"center"===c?d=a-f>=b?d+Math.round((a-f)/2):d+(this.ea.Kg+Math.round(b/2)):"left"===c?d+=this.ea.Kg:"right"===c&&(d+=a);f=Math.round(this.height/2);void 0!==this.ea.qd&&(f+=this.ea.qd);c=[];for(b=0;b<q.D;b++)h=new r(a+n,this.height),x(h),q.Ca(b,0,0,k,this.height,0,0,1),q.Ek(b,k,0,q.width-n,this.height,k,0,a,this.height,1),q.Ca(b,k+q.width-n,0,l,this.height,k+a,0,1),this.Rg.o(0,this.ea.Wh,this.ea.Xh),u.o(this.text,d,f,a),y(h),c.push(h);return c};e.Kc=function(a){a===M.of&&this.Wl()};
function oh(a,b,c,d,f,h,k){var l;this.Z=M.a.u.mc[a].Z;if(this.Z.length){for(a=0;a<this.Z.length;a++)if(this.Z[a].id===f){this.Oa=a;break}void 0===this.Oa&&(this.Oa=0);this.Rg=this.Z[this.Oa].q;a=new Zb(this.Rg);l=this;f="function"===typeof h?function(){l.Cg();return h(l.Z[l.Oa].id)}:"object"===typeof h?{ta:this,da:function(){l.Cg();return h.da.call(h.ta,l.Z[l.Oa].id)}}:function(){l.Cg()};kg.call(this,b,c,d,a,[this.Rg],f,k)}}M.d.mj(oh);
oh.prototype.Cg=function(a){var b;if(void 0===a)this.Oa=(this.Oa+1)%this.Z.length;else for(b=0;b<this.Z.length;b++)if(this.Z[b].id===a){this.Oa=b;break}this.Oj(this.Z[this.Oa].q)};oh.prototype.Oj=function(a){this.Rg=a;Qg(this,[].concat(this.Rg))};
function zh(a,b,c,d){this.depth=10;this.visible=!1;this.h=!0;M.d.Ja(this,M.Cc);var f;this.a=M.a.u.ml;if("landscape"===M.orientation&&M.a.u.yo)for(f in M.a.u.yo)this.a[f]=M.a.u.yo[f];for(f in M.a.R.ml)this.a[f]=M.a.R.ml[f];this.ro=a;this.an=b;this.da=c;this.ta=d;this.wj="entering";this.Wt=!1;J(this,!1);Rb(this,"LevelStartDialog")}
function Ah(a){var b,c,d,f,h;if("leaving"!==a.wj){a.wj="leaving";a.Xf=0;b=function(){K(I,a);a.ta?a.da.call(a.ta):a.da&&a.da()};if(void 0!==a.a.Wo)for(c=0;c<a.a.Wo.length;c++)d=a.a.Wo[c],f=void 0,d.Dq&&(a.Xf++,f=b),h=d.end,"x"===d.type?h=M.d.g(h,a.canvas.width,a.f.b.width):"y"===d.type&&(h=M.d.g(h,a.canvas.height,a.f.b.height)+Math.abs(M.qa)),kh(a.f,d.type,h,d.duration,d.hb,f,d.Na,d.loop,d.Ho);0===a.Xf&&b()}}e=zh.prototype;
e.Vb=function(){var a,b,c,d,f,h,k=this;a=this.a.md;b=a.width;f=a.height;this.f=new gh(this.depth+10,this.Qa,new r(b,f));x(this.f.b);a.o(0,0,0);""!==this.an&&(c=M.d.g(this.a.rq,b,0),d=M.d.g(this.a.sq,f,0),a=W.P(),A(a,this.a.qq),void 0!==this.a.Fi&&void 0!==this.a.$m&&(h=Va(a,this.an,this.a.Fi,this.a.$m,this.a.Fi),a.fontSize>h&&D(a,h)),a.o(this.an,c,d,this.a.Fi));""!==this.ro&&(c=M.d.g(this.a.Hr,b,0),d=M.d.g(this.a.Ir,f,0),a=W.P(),A(a,this.a.Fr),void 0!==this.a.dl&&void 0!==this.a.Gr&&(h=Va(a,this.ro,
this.a.dl,this.a.Gr,this.a.dl),a.fontSize>h&&D(a,h)),a.o(this.ro,c,d,this.a.dl));y(this.f.b);this.f.x=M.d.g(this.a.Ns,this.canvas.width,b);this.f.y=M.d.g(this.a.Xo,this.canvas.height,f)+Math.abs(M.qa);this.Xf=0;a=function(){k.Xf--;0===k.Xf&&(k.wj="paused")};if(void 0!==this.a.Il)for(b=0;b<this.a.Il.length;b++)f=this.a.Il[b],c=void 0,f.Dq&&(this.Xf++,c=a),d=f.end,"x"===f.type?d=M.d.g(d,this.canvas.width,this.f.b.width):"y"===f.type&&(d=M.d.g(d,this.canvas.height,this.f.b.height)+Math.abs(M.qa)),kh(this.f,
f.type,d,f.duration,f.hb,c,f.Na,f.loop,f.Ho),void 0!==f.Rb&&G.play(f.Rb);0===this.Xf&&(this.wj="paused");this.m=0};e.jb=function(){K(I,this.f)};e.Y=function(a){"paused"!==this.state&&(this.m+=a,this.m>=this.a.Os&&Ah(this))};e.Ob=function(){return this.Wt=!0};e.Pb=function(){this.Wt&&"paused"===this.wj&&Ah(this);return!0};
function gh(a,b,c){this.depth=a;this.h=this.visible=!0;M.d.Ja(this,b);this.b=c;this.cc=0;this.width=c.width;this.height=c.height;this.Ed=this.Dd=this.y=this.x=0;this.eb=this.ab=1;this.na=0;this.alpha=1;this.Cb=[];this.pq=0;this.parent={x:0,y:0};this.jd=!0;J(this,!1)}
function kh(a,b,c,d,f,h,k,l,n){var q,u=0<k;switch(b){case "x":q=a.x;break;case "y":q=a.y;break;case "xScale":q=a.ab;break;case "yScale":q=a.eb;break;case "scale":b="xScale";q=a.ab;kh(a,"yScale",c,d,f,void 0,k,l,n);break;case "angle":q=a.na;break;case "alpha":q=a.alpha;break;case "subImage":q=0}a.Cb.push({id:a.pq,m:0,h:!0,Ak:u,type:b,start:q,end:c,Db:h,duration:d,hb:f,Na:k,loop:l,Ho:n});a.pq++}
function Vg(a){var b;for(b=a.Cb.length-1;0<=b;b--){switch(a.Cb[b].type){case "x":a.x=a.Cb[b].end;break;case "y":a.y=a.Cb[b].end;break;case "xScale":a.ab=a.Cb[b].end;break;case "yScale":a.eb=a.Cb[b].end;break;case "angle":a.na=a.Cb[b].end;break;case "alpha":a.alpha=a.Cb[b].end;break;case "subImage":a.cc=a.Cb[b].end}"function"===typeof a.Cb[b].Db&&a.Cb[b].Db.call(a)}}
gh.prototype.Y=function(a){var b,c,d;for(b=0;b<this.Cb.length;b++)if(c=this.Cb[b],c.h&&(c.m+=a,c.Ak&&c.m>=c.Na&&(c.m%=c.Na,c.Ak=!1),!c.Ak)){c.m>=c.duration?(d=c.end,c.loop?(c.Ak=!0,c.Na=c.Ho,c.m%=c.duration):("function"===typeof c.Db&&c.Db.call(this),this.Cb[b]=void 0)):"subImage"===c.type?(d=this.b instanceof Array?this.b.length:this.b.D,d=Math.floor(c.m*d/c.duration)):d=c.hb(c.m,c.start,c.end-c.start,c.duration);switch(c.type){case "x":this.x=d;break;case "y":this.y=d;break;case "xScale":this.ab=
d;break;case "yScale":this.eb=d;break;case "angle":this.na=d;break;case "alpha":this.alpha=d;break;case "subImage":this.cc=d}this.canvas.W=!0}for(b=this.Cb.length-1;0<=b;b--)void 0===this.Cb[b]&&this.Cb.splice(b,1)};
gh.prototype.ya=function(){var a,b,c;b=Math.round(this.x-this.ab*this.Dd)+this.parent.x;c=Math.round(this.y-this.eb*this.Ed)+this.parent.y;a=this.b;a instanceof Array&&(a=this.b[this.cc%this.b.length]);a instanceof r?a.S(b,c,this.ab,this.eb,this.na,this.alpha):a.S(this.cc,b,c,this.ab,this.eb,this.na,this.alpha);this.jd=!1};
function $g(a,b,c,d,f,h,k,l,n,q,u){this.depth=f;this.visible=!0;this.h=!1;M.d.Ja(this,M.Cc);this.x=a;this.y=b;this.Jo=l;this.Ko="object"===typeof n?n.top:n;this.qw="object"===typeof n?n.bottom:n;this.$=c;this.U=d;this.width=this.$+2*this.Jo;this.height=this.U+this.Ko+this.qw;this.value=h||0;this.parent=q||{x:0,y:0};this.font=k;this.toString="function"===typeof u?u:function(a){return a+""};this.alpha=1;this.ac=this.$b=this.Ed=this.Dd=0;c=new r(this.width,this.height);this.dh=new gh(this.depth,this.Qa,
c);this.dh.x=a-this.Jo;this.dh.y=b-this.Ko;this.dh.parent=q;this.K=this.dh.b;this.vf();J(this)}$g.prototype.jb=function(){K(I,this.dh)};function jh(a,b,c){a.h=!0;a.Vf=a.value;a.value=a.Vf;a.end=b;a.duration=c;a.hb=L;a.m=0}
$g.prototype.vf=function(){var a,b;a=this.font.align;b=this.font.i;var c=this.Jo,d=this.Ko;this.wq||(this.K.clear(),this.canvas.W=!0);x(this.K);this.wq&&this.wq.Ca(0,this.fz,this.gz,this.ez,this.dz,0,0,1);"center"===a?c+=Math.round(this.$/2):"right"===a&&(c+=this.$);"middle"===b?d+=Math.round(this.U/2):"bottom"===b&&(d+=this.U);b=this.toString(this.value);a=Va(this.font,b,this.$,this.U,!0);a<this.font.fontSize&&D(this.font,a);this.font.o(b,c,d,this.$);y(this.K);this.dh.jd=!0};
$g.prototype.Y=function(a){var b;b=Math.round(this.hb(this.m,this.Vf,this.end-this.Vf,this.duration));this.m>=this.duration?(this.value=this.end,this.h=!1,this.vf()):b!==this.value&&(this.value=b,this.vf());this.m+=a};function Bh(a,b,c){this.depth=-100;this.visible=!1;this.h=!0;this.vx=a;M.d.Ja(this,M.Cc);this.a=M.a.u.xn;this.Ac=M.a.u.mc;this.Lq=b;for(var d in M.a.R.xn)this.a[d]=M.a.R.xn[d];this.Yo=!1!==c;J(this)}e=Bh.prototype;e.Tt=function(){};
e.Di=function(a,b,c,d,f){b=new Fg("default_text",b,c,this.depth-20,a.T||"NO_TEXT_KEY_GIVEN",d,{da:function(){a.da&&(a.ta?a.da.call(a.ta,a):a.da(a))},ta:this},this.f);this.buttons.push(b);a.text&&b.Oj(b.b,a.text);this.buttons[this.buttons.length-1].xb=f||!1};
e.Pa=function(a,b,c){x(this.f.b);m.clear();this.a.backgroundImage.o(0,0,0);a=c?c:this.vx;b=W.P();this.a.Ts&&A(b,this.a.Ts);c=Va(b,a,this.a.dp,this.a.cp,!0);c<b.fontSize&&D(b,c);c=b.$(a,this.a.dp)+10;var d=b.U(a,this.a.cp)+10;b.o(a,M.d.Ba(this.a.Ax,this.f.b.width,c,b.align),M.d.Ba(this.a.Bx,this.f.b.height-Ch(this),d,b.i),c);y(this.f.b)};function Ch(a){var b=a.Lq;return M.d.g(a.a.Ji,a.f.b.height,a.Ac.default_text.q.height*b.length+a.a.Qd*(b.length-1))}
e.Sf=function(a,b){var c,d,f,h,k,l,n,q,u,B=[],B=this.Lq;f=this.Ac.default_text.q.height;h=this.a.uk;k=M.d.g(this.a.tk,this.canvas.width,h)-a;q=Ch(this);for(c=B.length-1;0<=c;c--){n=k;u=h;if("object"===typeof B[c]&&B[c].hasOwnProperty("length")&&B[c].length)for(l=B[c],u=(h-(l.length-1)*this.a.Qd)/l.length,d=0;d<l.length;d++)this.Di(l[d],n,q,u,b),n+=u+this.a.Qd;else this.Di(B[c],n,q,u,b);q-=f+this.a.Qd}};
e.show=function(){var a,b;for(a=0;a<this.buttons.length;a++)b=this.buttons[a],b.at(!0);this.f.visible=!0};e.close=function(){K(I,this);return this.canvas.W=!0};function Dh(a){var b=M.e.bf;b.Pa(b.f.x,b.f.y,a);for(a=0;a<b.buttons.length;a++)K(I,b.buttons[a]);b.canvas.W=!0}
e.Vb=function(){var a,b;this.Yo&&fh(this);a=this.a.backgroundImage;this.f=new gh(this.depth-10,this.Qa,new r(a.width,a.height));this.f.x=M.d.g(this.a.tc,this.canvas.width,a.width);a=M.d.g(this.a.Zb,this.canvas.height,a.height)+-1*("landscape"===M.orientation?M.a.u.nn:M.a.u.Rd).wl;this.f.y=a;this.Pa(this.f.x,this.f.y);this.buttons=[];this.Sf(this.f.x);b=this;this.f.y=-this.f.b.height;kh(this.f,"y",a,this.a.uj,this.a.vj,function(){var a;for(a=0;a<b.buttons.length;a++)b.buttons[a].xb=!0})};
e.jb=function(){var a;this.Yo&&lh();for(a=0;a<this.buttons.length;a++)K(I,this.buttons[a]);K(I,this.f);M.e.ke===this&&(M.e.ke=null)};e.Pb=function(){return!0};e.Ob=function(){return!0};
function Eh(a){if(null===a||"undefined"===typeof a)return"";a+="";var b="",c,d,f=0;c=d=0;for(var f=a.length,h=0;h<f;h++){var k=a.charCodeAt(h),l=null;if(128>k)d++;else if(127<k&&2048>k)l=String.fromCharCode(k>>6|192,k&63|128);else if(55296!==(k&63488))l=String.fromCharCode(k>>12|224,k>>6&63|128,k&63|128);else{if(55296!==(k&64512))throw new RangeError("Unmatched trail surrogate at "+h);l=a.charCodeAt(++h);if(56320!==(l&64512))throw new RangeError("Unmatched lead surrogate at "+(h-1));k=((k&1023)<<
10)+(l&1023)+65536;l=String.fromCharCode(k>>18|240,k>>12&63|128,k>>6&63|128,k&63|128)}null!==l&&(d>c&&(b+=a.slice(c,d)),b+=l,c=d=h+1)}d>c&&(b+=a.slice(c,f));return b}
function yg(a){function b(a){var b="",c="",d;for(d=0;3>=d;d++)c=a>>>8*d&255,c="0"+c.toString(16),b+=c.substr(c.length-2,2);return b}function c(a,b,c,d,f,h,l){a=k(a,k(k(c^(b|~d),f),l));return k(a<<h|a>>>32-h,b)}function d(a,b,c,d,f,h,l){a=k(a,k(k(b^c^d,f),l));return k(a<<h|a>>>32-h,b)}function f(a,b,c,d,f,h,l){a=k(a,k(k(b&d|c&~d,f),l));return k(a<<h|a>>>32-h,b)}function h(a,b,c,d,f,h,l){a=k(a,k(k(b&c|~b&d,f),l));return k(a<<h|a>>>32-h,b)}function k(a,b){var c,d,f,h,k;f=a&2147483648;h=b&2147483648;
c=a&1073741824;d=b&1073741824;k=(a&1073741823)+(b&1073741823);return c&d?k^2147483648^f^h:c|d?k&1073741824?k^3221225472^f^h:k^1073741824^f^h:k^f^h}var l=[],n,q,u,B,C,t,s,v,w;a=Eh(a);l=function(a){var b,c=a.length;b=c+8;for(var d=16*((b-b%64)/64+1),f=Array(d-1),h=0,k=0;k<c;)b=(k-k%4)/4,h=k%4*8,f[b]|=a.charCodeAt(k)<<h,k++;b=(k-k%4)/4;f[b]|=128<<k%4*8;f[d-2]=c<<3;f[d-1]=c>>>29;return f}(a);t=1732584193;s=4023233417;v=2562383102;w=271733878;a=l.length;for(n=0;n<a;n+=16)q=t,u=s,B=v,C=w,t=h(t,s,v,w,l[n+
0],7,3614090360),w=h(w,t,s,v,l[n+1],12,3905402710),v=h(v,w,t,s,l[n+2],17,606105819),s=h(s,v,w,t,l[n+3],22,3250441966),t=h(t,s,v,w,l[n+4],7,4118548399),w=h(w,t,s,v,l[n+5],12,1200080426),v=h(v,w,t,s,l[n+6],17,2821735955),s=h(s,v,w,t,l[n+7],22,4249261313),t=h(t,s,v,w,l[n+8],7,1770035416),w=h(w,t,s,v,l[n+9],12,2336552879),v=h(v,w,t,s,l[n+10],17,4294925233),s=h(s,v,w,t,l[n+11],22,2304563134),t=h(t,s,v,w,l[n+12],7,1804603682),w=h(w,t,s,v,l[n+13],12,4254626195),v=h(v,w,t,s,l[n+14],17,2792965006),s=h(s,v,
w,t,l[n+15],22,1236535329),t=f(t,s,v,w,l[n+1],5,4129170786),w=f(w,t,s,v,l[n+6],9,3225465664),v=f(v,w,t,s,l[n+11],14,643717713),s=f(s,v,w,t,l[n+0],20,3921069994),t=f(t,s,v,w,l[n+5],5,3593408605),w=f(w,t,s,v,l[n+10],9,38016083),v=f(v,w,t,s,l[n+15],14,3634488961),s=f(s,v,w,t,l[n+4],20,3889429448),t=f(t,s,v,w,l[n+9],5,568446438),w=f(w,t,s,v,l[n+14],9,3275163606),v=f(v,w,t,s,l[n+3],14,4107603335),s=f(s,v,w,t,l[n+8],20,1163531501),t=f(t,s,v,w,l[n+13],5,2850285829),w=f(w,t,s,v,l[n+2],9,4243563512),v=f(v,
w,t,s,l[n+7],14,1735328473),s=f(s,v,w,t,l[n+12],20,2368359562),t=d(t,s,v,w,l[n+5],4,4294588738),w=d(w,t,s,v,l[n+8],11,2272392833),v=d(v,w,t,s,l[n+11],16,1839030562),s=d(s,v,w,t,l[n+14],23,4259657740),t=d(t,s,v,w,l[n+1],4,2763975236),w=d(w,t,s,v,l[n+4],11,1272893353),v=d(v,w,t,s,l[n+7],16,4139469664),s=d(s,v,w,t,l[n+10],23,3200236656),t=d(t,s,v,w,l[n+13],4,681279174),w=d(w,t,s,v,l[n+0],11,3936430074),v=d(v,w,t,s,l[n+3],16,3572445317),s=d(s,v,w,t,l[n+6],23,76029189),t=d(t,s,v,w,l[n+9],4,3654602809),
w=d(w,t,s,v,l[n+12],11,3873151461),v=d(v,w,t,s,l[n+15],16,530742520),s=d(s,v,w,t,l[n+2],23,3299628645),t=c(t,s,v,w,l[n+0],6,4096336452),w=c(w,t,s,v,l[n+7],10,1126891415),v=c(v,w,t,s,l[n+14],15,2878612391),s=c(s,v,w,t,l[n+5],21,4237533241),t=c(t,s,v,w,l[n+12],6,1700485571),w=c(w,t,s,v,l[n+3],10,2399980690),v=c(v,w,t,s,l[n+10],15,4293915773),s=c(s,v,w,t,l[n+1],21,2240044497),t=c(t,s,v,w,l[n+8],6,1873313359),w=c(w,t,s,v,l[n+15],10,4264355552),v=c(v,w,t,s,l[n+6],15,2734768916),s=c(s,v,w,t,l[n+13],21,
1309151649),t=c(t,s,v,w,l[n+4],6,4149444226),w=c(w,t,s,v,l[n+11],10,3174756917),v=c(v,w,t,s,l[n+2],15,718787259),s=c(s,v,w,t,l[n+9],21,3951481745),t=k(t,q),s=k(s,u),v=k(v,B),w=k(w,C);return(b(t)+b(s)+b(v)+b(w)).toLowerCase()}var hh;
function Fh(a,b){var c=M.w.el.url+"api";try{var d=new XMLHttpRequest;d.open("POST",c);d.setRequestHeader("Content-Type","application/x-www-form-urlencoded");d.onload=function(){"application/json"===d.getResponseHeader("Content-Type")&&b(JSON.parse(d.responseText))};d.onerror=function(a){console.log("error: "+a)};d.send(a)}catch(f){}}function Gh(a){Fh("call=api_is_valid",function(b){a(b.is_valid)})}
function ih(a,b){Fh("call=is_highscore&score="+a,function(a){0<=a.position?(hh=a.code,b(void 0!==hh)):b(!1)})}
PG_StatObjectFactory={Az:function(a){return new PG_StatObject("totalScore",a,"levelEndScreenTotalScore_"+a,0,0,!0,!0)},yz:function(a){return new PG_StatObject("highScore",a,"levelEndScreenHighScore_"+a,Hh(),Hh(),!0)},xz:function(a,b,c,d,f){return new PG_StatObject(a,b,c,0,d,f,!0,"max"===M.n.mh?function(a){return a+d}:function(a){return a-d})},zz:function(a,b,c,d,f){return new PG_StatObject(a,b,c,0,d,f,!0,"max"===M.n.mh?function(a){return a-d}:function(a){return a+d})}};
PG_StatObject=function(a,b,c,d,f,h,k,l,n){this.id=a;this.type=b;this.key=c;this.ed=d;this.Eg=void 0!==f?f:this.ed;this.visible=void 0!==h?h:!0;this.df=void 0!==k?k:this.ed!==this.Eg;this.Jf=l;this.hm=void 0!==n?n:"totalScore";switch(this.type){case "text":this.toString=function(a){return a};break;case "number":this.toString=function(a){return a+""};break;case "time":this.toString=function(a){return M.d.Cp(1E3*a)}}};
PG_StatObject.prototype.P=function(){return new PG_StatObject(this.id,this.type,this.key,this.ed,this.Eg,this.visible,this.df,this.Jf,this.hm)};M.version=M.version||{};M.version.tg="2.13.0";function Ih(a,b,c,d,f,h,k,l){this.depth=c;this.h=this.visible=!0;this.group="Floater";this.x=a;this.y=b;this.K=d;this.hu=f;this.yj=h;this.Ub=k;this.scale=this.state=this.m=0;this.alpha=1;this.Ix=l||tc;M.d.Ja(this,M.th);"undefined"===typeof this.canvas&&(this.canvas=M.Zd);J(this)}
Ih.prototype.jb=function(){this.canvas.W=!0};Ih.prototype.Y=function(a){this.m+=a;0===this.state?this.m>=this.yj?(this.state=this.scale=1,this.m=0):(this.y+=this.hu*a/1E3,this.scale=this.Ix(this.m,0,1,this.yj)):(this.m>=this.Ub&&K(I,this),this.y+=this.hu*a/1E3,this.alpha=1-this.m/this.Ub);this.canvas.W=!0};Ih.prototype.ya=function(){this.K.S(this.x-this.K.width*this.scale/2,this.y-this.K.height*this.scale/2,this.scale,this.scale,0,this.alpha)};
function Jh(a){this.depth=1E3;this.h=this.visible=!1;this.group=a;J(this)}function Kh(a,b,c,d,f,h,k,l){var n;if(l&&l.hasOwnProperty(b))return new Ih(c,d,-450,l[b],f,200,h,k);n=new r(a.$(b)+10+50,a.U(b)+50);x(n);a.align="left";a.i="top";a.o(b,30,25);y(n);l&&(l[b]=n);return new Ih(c,d,-450,n,f,200,h,k)}Jh.prototype.fp=function(){var a,b;a=Sb(I,function(a){return"Floater"===a.group});for(b=0;b<a.length;b+=1)K(I,a[b])};
Jh.prototype.Vb=function(){var a,b,c,d,f,h;this.rv=[];b=[R,S,U,V];a=[M.k.I("Floater1","<FLOATER_1>"),M.k.I("Floater2","<FLOATER_2>"),M.k.I("Floater3","<FLOATER_3>"),M.k.I("Floater4","<FLOATER_4>")];for(c=0;c<b.length;c+=1)d=b[c],f=a[Math.min(c,a.length)],h=new r(d.$(f)+10,d.U(f)),x(h),d.align="left",d.i="top",d.o(f,5,0),y(h),this.rv.push(h)};Jh.prototype.jb=function(){this.fp()};
var Y={Ht:{},It:{},Jt:{},Kt:{},Ro:{},So:{},uy:{},Ov:{},xu:function(){Y.Ht={rc:Y.zk,update:Y.Ce,oc:Y.Ae,end:Y.Be,font:Ne,margin:20,Td:L,Ud:L,Sd:vc([mc,ic,mc],[!1,!1,!0],[.1,.8,.1])};Y.It={rc:Y.zk,update:Y.Ce,oc:Y.Ae,end:Y.Be,font:Oe,margin:20,Td:L,Ud:L,Sd:vc([mc,ic,mc],[!1,!1,!0],[.1,.8,.1])};Y.Jt={rc:Y.zk,update:Y.Ce,oc:Y.Ae,end:Y.Be,font:Pe,margin:20,Td:L,Ud:L,Sd:vc([mc,ic,mc],[!1,!1,!0],[.1,.8,.1])};Y.Kt={rc:Y.zk,update:Y.Ce,oc:Y.Ae,end:Y.Be,font:Qe,margin:20,Td:L,Ud:L,Sd:vc([mc,ic,mc],[!1,!1,!0],
[.1,.8,.1])};Y.Ro={rc:Y.av,update:Y.Ce,oc:Y.Ae,end:Y.Be,Zi:Re,Yi:Se,margin:20,Td:L,Ud:L,Sd:vc([mc,ic,mc],[!1,!1,!0],[.1,.8,.1])};Y.So={rc:Y.bv,update:Y.Ce,oc:Y.Ae,end:Y.Be,Zi:Re,Yi:Se,margin:20,Td:L,Ud:L,Sd:vc([mc,ic,mc],[!1,!1,!0],[.1,.8,.1])};Y.uy={rc:Y.cv,update:Y.Ce,oc:Y.Ae,end:Y.Be,Td:L,Ud:L,Sd:vc([mc,ic,mc],[!1,!1,!0],[.1,.8,.1])};Y.Ov={rc:Y.$u,update:Y.Ce,oc:Y.Ae,end:Y.Be,Td:L,Ud:L,Sd:vc([mc,ic,mc],[!1,!1,!0],[.1,.8,.1])}},tz:function(a){function b(a){var d,f={};for(d in a)f[d]="object"===
typeof a[d]&&null!==a[d]?b(a[d]):a[d];return f}return b(a)},KB:function(a){Y.Ht.font.H=a;Y.It.font.H=a;Y.Jt.font.H=a;Y.Kt.font.H=a},JB:function(a){Y.Ro.Zi.H=a;Y.Ro.Yi.H=a;Y.So.Zi.H=a;Y.So.Yi.H=a},bi:!1,wc:[],IB:function(a){Y.bi=a},$z:function(){return Y.bi},Ex:function(a){var b,c;for(b=0;b<Y.wc.length;b+=1)c=Y.wc[b],void 0===c||void 0!==a&&c.kind!==a||0<c.Kh||(Y.wc[b]=void 0)},wu:function(){Y.bi=!1;Y.wc=[]},di:function(a,b,c,d){var f,h,k;void 0===d&&(d=Y.bi);if(d)for(h=0;h<Y.wc.length;h+=1)if(f=Y.wc[h],
void 0!==f&&f.nf&&f.kind===a&&f.font===b&&f.text===c)return f.Kh+=1,h;f={kind:a,font:b,text:c,Kh:1,nf:d};h=b.align;k=b.i;E(b,"center");F(b,"middle");d=b.$(c)+2*a.margin;a=b.U(c)+2*a.margin;f.K=new r(d,a);x(f.K);b.o(c,d/2,a/2);y(f.K);E(b,h);F(b,k);for(h=0;h<Y.wc.length;h+=1)if(void 0===Y.wc[h])return Y.wc[h]=f,h;Y.wc.push(f);return Y.wc.length-1},vu:function(a){var b=Y.wc[a];b.Kh-=1;0>=b.Kh&&!b.nf&&(Y.wc[a]=void 0)},zk:function(a){a.buffer=Y.di(a.kind,a.kind.font,a.value,a.nf)},av:function(a){var b=
a.value.toString();a.buffer=0<=a.value?Y.di(a.kind,a.kind.Zi,b,a.nf):Y.di(a.kind,a.kind.Yi,b,a.nf)},bv:function(a){var b=a.value.toString();0<a.value&&(b="+"+b);a.buffer=0<=a.value?Y.di(a.kind,a.kind.Zi,b,a.nf):Y.di(a.kind,a.kind.Yi,b,a.nf)},cv:function(a){a.K=a.value},$u:function(a){a.b=a.value;a.cc=0},Ce:function(a){a.x=void 0!==a.kind.Td?a.kind.Td(a.time,a.fm,a.ir-a.fm,a.duration):a.fm+a.time/a.duration*(a.ir-a.fm);a.y=void 0!==a.kind.Ud?a.kind.Ud(a.time,a.gm,a.jr-a.gm,a.duration):a.gm+a.time/
a.duration*(a.jr-a.gm);void 0!==a.kind.fr&&(a.$b=a.kind.fr(a.time,0,1,a.duration));void 0!==a.kind.gr&&(a.ac=a.kind.gr(a.time,0,1,a.duration));void 0!==a.kind.Sd&&(a.alpha=a.kind.Sd(a.time,0,1,a.duration));void 0!==a.kind.hv&&(a.na=a.kind.hv(a.time,0,360,a.duration)%360);void 0!==a.b&&(a.cc=a.time*a.b.D/a.duration)},Ae:function(a){var b=m.context,c;void 0!==a.b&&null!==a.images?1===a.$b&&1===a.ac&&0===a.na?a.b.dd(Math.floor(a.cc),a.x,a.y,a.alpha):a.b.S(Math.floor(a.cc),a.x,a.y,a.$b,a.ac,a.na,a.alpha):
(c=void 0!==a.K&&null!==a.K?a.K:Y.wc[a.buffer].K,1===a.$b&&1===a.ac&&0===a.na?c.dd(a.x-c.width/2,a.y-c.height/2,a.alpha):1E-4>Math.abs(a.$b)||1E-4>Math.abs(a.ac)||(b.save(),b.translate(a.x,a.y),b.rotate(-a.na*Math.PI/180),b.scale(a.$b,a.ac),c.dd(-c.width/2,-c.height/2,a.alpha),b.restore()))},Be:function(a){void 0!==a.buffer&&Y.vu(a.buffer)},Ge:function(a){var b,c,d=!1;for(b=0;b<Y.Tb.length;b+=1)c=Y.Tb[b],void 0!==c&&(0<c.Na?(c.Na-=a,0>c.Na&&(c.time+=-c.Na,c.Na=0)):c.time+=a,0<c.Na||(c.time>=c.duration?
(c.kind.end(c),Y.Tb[b]=void 0):c.kind.update(c),d=!0));d&&(Y.canvas.W=!0)},ya:function(){var a,b;for(a=0;a<Y.Tb.length;a+=1)b=Y.Tb[a],void 0!==b&&(0<b.Na||b.kind.oc(b))},Tb:[],iA:function(a,b,c){Y.jv();void 0===a&&(a=M.th);void 0===b&&(b=-1E6);void 0===c&&(c=["game"]);Y.visible=!0;Y.h=!0;M.d.Ja(Y,a);Y.depth=b;J(Y);Rb(Y,c);Y.wu();Y.xu()},Vy:function(a,b,c,d,f,h,k,l,n){void 0===l&&(l=void 0!==a.Na?a.Na:0);void 0===n&&(n=Y.bi);void 0===f&&void 0!==a.Uw&&(f=c+a.Uw);void 0===h&&void 0!==a.Vw&&(h=d+a.Vw);
void 0===k&&void 0!==a.duration&&(k=a.duration);a={kind:a,value:b,fm:c,gm:d,ir:f,jr:h,x:c,y:d,$b:1,ac:1,alpha:1,na:0,time:0,duration:k,Na:l,nf:n};a.kind.rc(a);for(b=0;b<Y.Tb.length;b+=1)if(void 0===Y.Tb[b])return Y.Tb[b]=a,b;Y.Tb.push(a);return Y.Tb.length-1},nB:function(a){var b;0>a||a>=Y.Tb.length||(b=Y.Tb[a],void 0!==b&&(b.kind.end(b),Y.Tb[a]=void 0))},fp:function(){var a,b;for(a=0;a<Y.Tb.length;a+=1)b=Y.Tb[a],void 0!==b&&(b.kind.end(b),Y.Tb[a]=void 0);Y.Tb=[]},jv:function(){Y.fp();Y.Ex();K(I,
Y)}};function Lh(a){this.depth=-99;M.d.Ja(this,M.Cc);this.h=!0;this.visible=!1;this.e=a;J(this)}Lh.prototype.og=function(){};Lh.prototype.pg=function(){};Lh.prototype.Ob=function(a,b,c){a:{var d=this.e,f;for(f=0;f<d.Tc.length;++f)if(d.Tc[f].Ob&&d.Tc[f].Ob(a,b,c)){a=!0;break a}a=!1}return a};
Lh.prototype.Pb=function(a,b,c){var d;a:if(d=this.e,d.tb&&a===d.Op)a=d.tb.a.x,b=d.tb.a.y,d.tb.Vo&&(a=d.tb.Vo.x,b=d.tb.Vo.y),GameUISettingsOffsets?console.log("Component:\n x: tgScale("+(a+d.tb.Ug.x-GameUISettingsOffsets.Ty)+") + GameUISettingsOffsets.X,\n y: tgScale("+(b+d.tb.Ug.y-GameUISettingsOffsets.Uy)+") + GameUISettingsOffsets.Y,"):console.log("Component:\n x: tgScale("+(a+d.tb.Ug.x)+"),\n y: tgScale("+(b+d.tb.Ug.y)+"),"),d.du=!1,d=!0;else{for(var f=0;f<d.Tc.length;++f)if(d.Tc[f].Pb&&d.Tc[f].Pb(a,
b,c)){d=!0;break a}d=!1}return d};function Mh(){this.Qa=this.depth=0;this.An=this.hc=this.h=this.visible=!1;this.Tc=[];this.Kk={};this.Kk.Ne=!1;this.kr={};this.paused=this.kr.Ne=!1;this.oy=new r(0,0);this.qy=this.py=0;this.tb=null;this.Op=this.fu=this.eu=-1;this.du=!1;this.Yb=this.Xb=0;this.il=null}e=Mh.prototype;e.Vb=function(){this.il=new Lh(this)};e.jb=function(){this.il&&(K(I,this.il),this.il=null)};
function Nh(a,b,c){for(var d in b){var f=b[d];f.b?c[d]=new Oh(a,f):f.Nt?c[d]=new Ph(a,M.k.I(f.Nt,"<"+f.Nt+">"),f):f.T?c[d]=new Ph(a,M.k.I(f.T,"<"+f.T+">"),f):f.text&&(c[d]=new Ph(a,f.text,f))}}function Qh(a,b){a.Ne&&(a.m+=b,a.m>=a.duration&&(a.Ne=!1,a.Db&&a.Db()))}
e.Y=function(a){Qh(this.Kk,a);Qh(this.kr,a);for(var b=0;b<this.Tc.length;++b)this.Tc[b].Y(a);if(this.tb&&this.du){a=I.ha[this.Op].x;b=I.ha[this.Op].y;this.canvas===M.d.ng(M.lg)&&this.tb.Zk(this.Xb+M.mg,this.Yb+M.kf);var c=a-this.eu,d=b-this.fu;this.tb.x+=c;this.tb.y+=d;this.tb.Ug.x+=c;this.tb.Ug.y+=d;this.eu=a;this.fu=b;this.hc=!0}};e.Ge=function(){if(this.hc){var a=M.d.ng(M.lg);this.canvas!==a?this.canvas.W=this.hc:(m.ia(a),this.ya())}};
e.Gk=function(a,b){for(var c=M.d.ng(M.lg)===this.canvas,d=0;d<this.Tc.length;++d){var f=this.Tc[d];f.visible&&(c&&f.Zk(a,b),f.ya(a,b))}};e.ya=function(){var a=0,b=0;M.d.ng(M.Wk)!==this.canvas&&(a=M.mg,b=M.kf);this.paused?this.oy.o(this.py+this.Xb+a,this.qy+this.Yb+b):this.Gk(this.Xb+a,this.Yb+b);this.hc=!1};function Rh(){this.Lr=[];this.lr=[];this.bt=null;this.cn=void 0;this.Qn=!0}
function Sh(a){function b(a,b){if(!b)return!1;var f=0;if("string"===typeof a){if(d(a))return!1}else for(f=0;f<a.length;++f)if(d(a[f]))return!1;if(b.Fz){if("string"===typeof a){if(c(a))return!0}else for(f=0;f<a.length;++f)if(c(a[f]))return!0;return!1}return!0}function c(a){for(var b in k)if(b===a||k[b]===a)return!0;return!1}function d(a){for(var b in h)if(b===a||h[b]===a)return!0;return!1}var f;if(a instanceof Rh){if(1!==arguments.length)throw"When using GameUIOptions as argument to GameUIController constructor you should not use extraComponents of gameUiSettings as parameters anymore.";
f=a}else f=new Rh,f.Lr=arguments[0],f.lr=arguments[1],f.bt=arguments[2];var h=null,k=null,l=null,h=f.Lr,k=f.lr,l=f.bt;this.Lh=f;void 0===this.Lh.cn&&(this.Lh.cn=!Ag(M.e));Mh.apply(this,arguments);J(this);this.h=this.visible=!0;k=k||[];h=h||[];this.Qt=2;this.qk=this.Nx=!1;this.p=l||Th;this.Yq=M.Wk;void 0!==this.p.Qa&&(this.Yq=this.p.Qa);M.d.Ja(this,this.Yq);this.Xj=this.Wj=0;this.p.background.Qv&&(this.Wj=this.p.background.Qv);this.p.background.Rv&&(this.Xj=this.p.background.Rv);this.p.background.elements||
(this.td=this.p.background.b);this.p.background.cz?(Nh(this,this.p.background.elements,{}),this.td=this.p.background.b):(f=this.p.background.b,l=new Mh,Nh(l,this.p.background.elements,[]),f||this.Qa!==M.lg?(this.td=new r(f.width,f.height),x(this.td),f.o(0,0,0),l.Gk(-this.Wj,-this.Xj),y(this.td)):(m.ia(M.d.ng(this.Qa)),l.ya()));var n=this;this.Ur=0;b("score",this.p.Ws)?(this.$l=new Uh(this,this.p.Ws,"SCORE",0,!0),this.p.Jx&&new Oh(this,this.p.Jx)):this.$l=new Vh(0,0);this.jj=b("highScore",this.p.Mr)?
new Uh(this,this.p.Mr,"HIGHSCORE",0,!1):new Vh(0,0);b("highScore",this.p.Pr)&&new Oh(this,this.p.Pr);this.Ph=b(["stage","level"],this.p.kt)?new Uh(this,this.p.kt,"STAGE",0,!1):new Vh(0,0);b("lives",this.p.ps)&&new Uh(this,this.p.ps,"LIVES",0,!1);this.qm=b("time",this.p.time)?new Uh(this,this.p.time,"TIME",0,!1,function(a){return n.Cp(a)}):new Vh(0,0);this.qm.yf(36E4);if(this.p.Ab&&this.p.bp)throw"Don't define both progress and progressFill in your game_ui settings";this.Bj=b("progress",this.p.Ab)?
this.p.Ab.round?new Wh(this,this.p.Ab):new Xh(this,this.p.Ab):b("progress",this.p.bp)?new Xh(this,this.p.bp):new Vh(0,0);b("lives",this.p.Jr)&&new Oh(this,this.p.Jr);b("difficulty",this.p.yn)?new Ph(this,Yh().toUpperCase(),this.p.yn):Yh();b("difficulty",this.p.Ui)&&(f=s_ui_smiley_medium,f=(this.p.Ui.images?this.p.Ui.images:[s_ui_smiley_easy,s_ui_smiley_medium,s_ui_smiley_hard])[Cg()],this.p.Ui.b||(this.p.Ui.b=f),this.ev=new Oh(this,this.p.Ui),this.ev.Ys(f));this.p.mf&&!this.p.mf.length&&(this.p.mf=
[this.p.mf]);this.p.Yd&&!this.p.Yd.length&&(this.p.Yd=[this.p.Yd]);this.Yr=[];this.Zr=[];this.Yr[0]=b(["item","item0"],this.p.mf)?new Oh(this,this.p.mf[0]):new Vh(0,"");this.Zr[0]=b(["item","item0"],this.p.Yd)?new Ph(this,"",this.p.Yd[0]):new Vh(0,"");if(this.p.mf&&this.p.Yd)for(f=1;f<this.p.Yd.length;++f)b("item"+f,this.p.Yd[f])&&(this.Zr[f]=new Ph(this,"0 / 0",this.p.Yd[f]),this.Yr[f]=new Oh(this,this.p.mf[f]));for(var q in this.p)f=this.p[q],f.T&&new Ph(this,M.k.I(f.T,"<"+f.T+">")+(f.separator?
f.separator:""),f);this.ns=this.Rt=0;this.buttons={};for(q in this.p.buttons)f=Zh(this,this.p.buttons[q]),this.buttons[q]=f;this.p.ix&&(f=Zh(this,this.p.ix),this.buttons.pauseButton=f);this.vn={};for(q in this.p.vn)f=this.p.vn[q],f=new $h[f.uz](this,f),this.vn[q]=f;this.Yb=this.Xb=0}fg(Mh,Sh);var $h={};function Zh(a,b){var c=new ai(a,b,b.ea);a.Tc.push(c);c.Yz=b;return c}e=Sh.prototype;e.mp=function(a,b){this.buttons[b||"pauseButton"].mp(a)};
e.Cp=function(a){var b=Math.floor(a/6E4),c=Math.floor(a%6E4/1E3);return this.Nx?(c=Math.floor(a/1E3),c.toString()):b+(10>c?":0":":")+c};e.Bg=function(a){this.Bj.Bg(a);return this};e.wh=function(){return this.Bj.wh()};e.setTime=function(a){this.qm.yf(a);return this};e.getTime=function(){return this.qm.N()};function bi(a){var b=$.pc;b.jj.yf(a);b.Ur=a}function ci(a,b){a.Ph.yf(b);1<b&&a.Bj&&a.Bj.Dr&&a.Bj.Dr()}
e.Um=function(a){a=this.$l.N()+a;this.$l.yf(a);this.Lh.cn&&(this.jj.N()<a?this.jj.yf(a):a<this.jj.N()&&this.jj.yf(Math.max(a,this.Ur)));return this};e.jb=function(){Mh.prototype.jb.apply(this,arguments);m.ia(this.canvas);m.clear();for(var a in this.buttons)K(I,this.buttons[a])};
e.Y=function(a){1===this.Qt&&this.setTime(this.getTime()+a);if(2===this.Qt){if(this.Rt&&1E3*this.Rt>=this.getTime()){var b=Math.floor(this.getTime()/1E3),c=Math.floor(Math.max(this.getTime()-a,0)/1E3);b!==c&&(b=this.qm,b.Lc.m=0,b.Lc.xp=!0,b.font.setFillColor(b.Lc.color),b.vf(),"undefined"!==typeof a_gameui_timewarning_second&&G.play(a_gameui_timewarning_second))}this.setTime(Math.max(this.getTime()-a,0))}Mh.prototype.Y.apply(this,arguments);this.ns+=a};
e.Gk=function(a,b){this.td&&(this.td instanceof p?this.td.dd(0,a+this.Wj,b+this.Xj,1):this.td.dd(a+this.Wj,b+this.Xj,1));Mh.prototype.Gk.apply(this,arguments);this.An&&this.td&&sa(a,b,this.td.width,this.td.height,"blue",!0)};
function di(a,b,c,d,f,h){this.e=a;this.width=f;this.height=h;this.K=null;this.x=c;this.y=d;this.visible=!0;this.a=b;this.alpha=void 0!==b.alpha?b.alpha:1;this.scale=void 0!==b.scale?b.scale:1;this.M={};this.M.Xb=0;this.M.Yb=0;this.M.scale=this.scale;this.M.alpha=this.alpha;this.M.na=0;this.A={};this.A.Ne=!1;this.A.origin={};this.A.target={};this.A.m=0;this.a.Kk&&(ei(this,this.a.Kk),this.A.Ne=!1);this.e.Tc.push(this);fi||(fi={rc:function(a){a.value instanceof r?a.K=a.value:(a.b=a.value,a.cc=0)},update:Y.Ce,
oc:Y.Ae,end:Y.Be,Td:L,Ud:L,Sd:function(a,b,c,d){return 1-mc(a,b,c,d)},fr:function(a,b,c,d){return 1*mc(a,b,c,d)+1},gr:function(a,b,c,d){return 1*mc(a,b,c,d)+1}})}var fi;
function ei(a,b){a.A.origin.x=void 0===b.x?a.x:b.x;a.A.origin.y=void 0===b.y?a.y:b.y;a.A.origin.alpha=void 0!==b.alpha?b.alpha:1;a.A.origin.scale=void 0!==b.scale?b.scale:1;a.A.target.x=a.x;a.A.target.y=a.y;a.A.target.alpha=a.alpha;a.A.target.scale=a.scale;a.A.duration=b.duration;a.A.Ne=!0;a.A.hf=b.hf||mc;a.A.m=0;a.A.Na=b.Na||0;gi(a)}
function gi(a){a.A.m>=a.A.duration&&(a.A.m=a.A.duration,a.A.Ne=!1);var b=a.A.hf(a.A.m,a.A.origin.x,a.A.target.x-a.A.origin.x,a.A.duration),c=a.A.hf(a.A.m,a.A.origin.y,a.A.target.y-a.A.origin.y,a.A.duration);a.M.Xb=b-a.x;a.M.Yb=c-a.y;a.M.alpha=a.A.hf(a.A.m,a.A.origin.alpha,a.A.target.alpha-a.A.origin.alpha,a.A.duration);a.M.scale=a.A.hf(a.A.m,a.A.origin.scale,a.A.target.scale-a.A.origin.scale,a.A.duration);a.e.hc=!0}e=di.prototype;
e.ya=function(a,b){this.K&&this.K.S(this.x+this.M.Xb+a,this.y+this.M.Yb+b,this.M.scale,this.M.scale,0,this.M.alpha)};e.Zk=function(a,b){hi(this.x+this.M.Xb+a,this.y+this.M.Yb+b,this.width*this.M.scale,this.height*this.M.scale)};e.kl=function(a,b){return a>this.x+this.M.Xb&&a<this.x+this.M.Xb+this.width*this.M.scale&&b>this.y+this.M.Yb&&b<this.y+this.M.Yb+this.height*this.M.scale};e.at=function(a){this.visible!==a&&(this.visible=a,this.e.hc=!0)};
e.Y=function(a){this.A.Ne&&(0<this.A.Na?this.A.Na-=a:(this.A.m+=-this.A.Na,this.A.Na=0,this.A.m+=a,gi(this)))};function Vh(a,b){this.Ab=this.value=this.hl=b}e=Vh.prototype;e.yf=function(a){this.value=a};e.N=function(){return this.value};e.Bg=function(a){0>a&&(a=0);100<a&&(a=100);this.Ab=a};e.wh=function(){return this.Ab};e.Ys=function(){};
function Oh(a,b){this.Vo=b;this.a={};for(var c in b)this.a[c]=b[c];this.b=this.a.b;this.D=0;this.ag=this.a.ag;this.a.ZB&&(this.a.x+=this.b.$a,this.a.y+=this.b.Ua);di.call(this,a,this.a,this.a.x,this.a.y,this.b?this.b.width:1,this.b?this.b.height:1)}fg(di,Oh);$h.GameUIImage=Oh;function ii(a,b){a.D!==b&&(a.D=b,a.e.hc=!0)}e=Oh.prototype;
e.ya=function(a,b){this.b&&(this.ag&&(a+=-Math.floor(this.b.width/2),b+=-Math.floor(this.b.height/2)),this.b instanceof p?this.b.S(this.D,this.x+a+this.M.Xb,this.y+b+this.M.Yb,this.M.scale,this.M.scale,0,this.M.alpha):this.b.S(this.x+a+this.M.Xb,this.y+b+this.M.Yb,this.M.scale,this.M.scale,0,this.M.alpha),this.e.An&&sa(this.x+a-this.b.$a+1,this.y+b-this.b.Ua+1,this.b.width-2,this.b.height-2,"black",!0))};
e.kl=function(a,b){if(!this.b)return!1;var c=0,d=0;this.ag&&(c+=-Math.floor(this.b.width/2),d+=-Math.floor(this.b.height/2));c-=this.b.$a;d-=this.b.Ua;return a>c+this.x+this.M.Xb&&a<c+this.x+this.M.Xb+this.width*this.M.scale&&b>d+this.y+this.M.Yb&&b<d+this.y+this.M.Yb+this.height*this.M.scale};e.Zk=function(a,b){this.b&&(this.ag&&(a+=-Math.floor(this.b.width/2),b+=-Math.floor(this.b.height/2)),a-=this.b.$a,b-=this.b.Ua,hi(this.x+this.M.Xb+a,this.y+this.M.Yb+b,this.width*this.M.scale,this.height*this.M.scale))};
e.eo=function(a){a||(a=new g(0,0));a.x=this.x+M.mg+this.e.Xb;a.y=this.y+M.kf+this.e.Yb;return a};e.Ys=function(a){a!==this.b&&(this.b=a,this.e.hc=!0,this.b&&(this.width=this.b.width,this.height=this.b.height))};
function Ph(a,b,c){"object"===typeof b&&(c=b,b=c.T?M.k.I(c.T,"<"+c.T+">"):c.text||"");this.text=b;this.font=c.font.P();c.rh&&A(this.font,c.rh);this.Ls=c.x;this.Ms=c.y;this.Ks=c.uc;this.dx=this.font.fillColor;this.Ff=void 0===c.Ff?.2:c.Ff;di.call(this,a,c,Math.floor(c.x-.1*c.uc),Math.floor(c.y-.1*c.Dc),Math.floor(1.2*c.uc),Math.floor(1.2*c.Dc));this.K=new r(this.width,this.height);switch(this.font.align){case "left":this.Lg=Math.floor(.1*c.uc);break;case "right":this.Lg=Math.floor(1.1*c.uc);break;
case "center":this.Lg=Math.floor(.6*c.uc);break;default:throw"Unknown alignment: "+this.font.align;}a=Math.floor(this.Ff*this.font.fontSize);switch(this.font.i){case "top":this.Mg=Math.floor(.1*c.Dc);break;case "bottom":this.Mg=Math.floor(1.1*c.Dc)+a;break;case "middle":this.Mg=Math.floor(.6*c.Dc)+a;break;default:throw"Unknown baseline: "+this.font.i;}this.Lc={};this.Lc.color="red";this.Lc.duration=200;this.Lc.m=0;this.Lc.xp=!1;this.vf()}fg(di,Ph);$h.GameUIText=Ph;
Ph.prototype.Y=function(a){di.prototype.Y.apply(this,arguments);this.Lc.xp&&(this.Lc.m+=a,this.Lc.duration<=this.Lc.m&&(this.Lc.xp=!1,this.font.setFillColor(this.dx),this.vf()))};
Ph.prototype.vf=function(){this.K.clear();x(this.K);var a=this.font.$(this.text),b=1;a>this.Ks&&(b=this.Ks/a);this.font.S(this.text,this.Lg,this.Mg,b,b,0,1);this.e.An&&(sa(0,0,this.K.width,this.K.height,"black",!0),sa(this.Ls-this.x,this.Ms-this.y,this.K.width-2*(this.Ls-this.x),this.K.height-2*(this.Ms-this.y),"red",!0),ta(this.Lg-5,this.Mg,this.Lg+5,this.Mg),ta(this.Lg,this.Mg-5,this.Lg,this.Mg+5));this.e.hc=!0;y(this.K)};function ji(a){return""+a}function ki(a,b,c){return b+c}
function Uh(a,b,c,d,f,h){this.value=this.hl=d||0;this.Cm=-1;this.ju=c;this.a=b;this.iu=-99999;this.pm=b.pm||0;this.Ok=b.Ok?b.Ok:h||ji;c=ki;f&&0!==this.a.er&&(c=nc);this.Fa=new gg(this.hl,void 0===this.a.er?500:this.a.er,c);b.oh&&(this.oh="game_ui_"+b.oh);this.text=li(this)+this.Ok(this.hl);Ph.call(this,a,this.text,b)}fg(Ph,Uh);$h.GameUIValue=Uh;Uh.prototype.yf=function(a){this.value=a;ig(this.Fa,this.value)};Uh.prototype.N=function(){return this.value};
Uh.prototype.Mp=function(a){var b=this.Cm;if(a||I.vh-this.iu>this.pm)b=this.Ok(Math.floor(this.Fa.N()));this.Cm!==b&&(this.iu=I.vh,this.Cm=b,this.text=li(this)+b,this.vf())};Uh.prototype.Y=function(a){Ph.prototype.Y.apply(this,arguments);hg(this.Fa,a);Math.floor(this.Fa.N())!==this.Cm&&this.Mp()};function li(a){var b="";a.a.Bm&&(b=a.oh?M.k.I(a.oh,"<"+a.oh.toUpperCase()+">"):M.k.I("game_ui_"+a.ju,"<"+a.ju+">"));return b+(a.a.separator?a.a.separator:"")}
function Xh(a,b){this.Zf=this.Ab=0;this.a=b;this.Aj=this.Ag=0;this.b=b.b;this.ve=b.ve||b.b;this.so=b.so||null;this.a.Kl=this.a.Kl||0;this.a.Ll=this.a.Ll||0;this.bn=!0;this.Tl=b.Tl||0;this.J=[];this.qk=!1;this.Fa=new gg(0,200,tc);this.yc=new gg(0,200,tc);di.call(this,a,b,b.x,b.y,this.b.width,this.b.height)}fg(di,Xh);$h.GameUIProgress=Xh;Xh.prototype.Bg=function(a){0>a&&(a=0);100<a&&(a=100);this.qk?(this.Zf=a-this.Ab,ig(this.yc,this.Zf)):(ig(this.Fa,a),this.Ab=a)};Xh.prototype.wh=function(){return this.Ab};
Xh.prototype.Y=function(a){hg(this.Fa,a);var b=this.Fa.N();b!==this.Ag&&(this.e.hc=!0,this.Ag=b);hg(this.yc,a);a=this.yc.N();a!==this.Aj&&(this.e.hc=!0,this.Aj=a);b+=a;if(this.bn)for(a=0;a<this.J.length;++a){var c=b>=this.J[a].position&&this.Ab+this.Zf>=this.J[a].position;this.J[a].complete!==c&&(this.a.J&&(this.e.hc=!0,this.Ag=b),this.J[a].complete=c)}};
Xh.prototype.ya=function(a,b){var c,d,f;if(0===this.Tl&&(0<this.yc.N()&&this.ve.Ca(0,this.width*this.Fa.N()/100,0,this.ve.width*this.yc.N()/100,this.ve.height,a+this.x+this.width*this.Fa.N()/100,b+this.y),this.b.Ca(0,0,0,this.width*this.Fa.N()/100,this.height,a+this.x,b+this.y),this.a.J))for(c=0;c<this.J.length;++c)d=this.J[c],f=d.complete?s_ui_level_star_fill:s_ui_level_star_empty,f.o(0,a+this.x+this.width/100*d.position,b+this.y+this.a.J.y);if(1===this.Tl&&(0<this.yc.N()&&this.ve.Ca(0,0,this.height-
this.height*this.Fa.N()/100,this.width,this.height,a+this.x,b+this.y+(this.height-this.height*this.Fa.N()/100)),this.b.Ca(0,0,this.height-this.height*this.Fa.N()/100,this.width,this.height,a+this.x,b+this.y+(this.height-this.height*this.Fa.N()/100)),this.a.J))for(c=0;c<this.J.length;++c)d=this.J[c],f=d.complete?s_ui_level_star_fill:s_ui_level_star_empty,f.o(0,a+this.x+this.a.J.x,b+this.y+this.height-this.height/100*d.position);if(2===this.Tl&&(0<this.yc.N()&&this.ve.Ca(0,0,this.height*this.Fa.N()/
100,this.ve.width,this.ve.height*this.yc.N()/100,a+this.x+this.width*this.Fa.N()/100,b+this.y),this.b.Ca(0,0,0,this.width,this.height*this.Fa.N()/100,a+this.x,b+this.y),this.a.J))for(c=0;c<this.J.length;++c)d=this.J[c],f=d.complete?s_ui_level_star_fill:s_ui_level_star_empty,f.o(0,a+this.x+this.a.J.x,b+this.y+this.height/100*d.position);this.so&&this.so.o(0,a+this.x+this.a.Kl,b+this.y+this.a.Ll)};function ai(a,b,c){this.vm=!1;this.Mj=-1;this.e=a;this.a=b;this.h=!0;this.mp(c);Oh.call(this,a,b)}
fg(Oh,ai);$h.GameUIButton=ai;ai.prototype.mp=function(a){var b=null,c=null,d=this.e,f=this.a;void 0===a&&(a=f.ea?f.ea:0);switch(a){case 0:b=d.Lh.Qn?ee:fe;c=function(){Ag(M.e)?M.e.Pe(!1,!0,d.Lh.Qn):M.e.Pe();return!0};break;case 1:b=ge;c=function(){M.e.Pe();return!0};break;case 2:b=s_btn_small_quit;c=function(){mi(d.Lh.Qn);return!0};break;case 3:b=f.b}this.Db=c;this.a.b=b};ai.prototype.Ob=function(a,b,c){if(this.h)return this.kl(b-M.mg,c-M.kf)?(this.vm=!0,this.Mj=a,ii(this,1),!0):!1};
ai.prototype.Y=function(a){Oh.prototype.Y.apply(this,arguments);this.vm&&(this.kl(I.ha[this.Mj].x-M.mg,I.ha[this.Mj].y-M.kf)?ii(this,1):ii(this,0))};ai.prototype.Pb=function(a,b,c){return this.vm&&a===this.Mj?(ii(this,0),this.kl(b-M.mg,c-M.kf)&&this.Db&&this.Db(),this.vm=!1,this.Mj=-1,!0):!1};
function Wh(a,b){this.Zf=this.Ab=0;this.a=b;this.Aj=this.Ag=0;this.bn=!0;this.J=[];this.color=b.color||"#00AEEF";this.Eq=b.Eq||"#FF0F64";this.Bq=b.Bq||"#FFED93";this.Cq=void 0===b.blink||b.blink;this.md=b.md;this.fh=this.qk=!1;this.Wf=0;this.ok=1E3;this.pk=0;this.Fa=new gg(0,200,tc);this.yc=new gg(0,200,tc);di.call(this,a,b,b.x,b.y,1,1)}fg(di,Wh);$h.GameUIRoundProgress=Wh;function ni(a){a.Cq&&(a.fh?a.Wf-=a.ok:(a.fh=!0,a.Wf=0,a.pk=0,ig(a.Fa,100)))}e=Wh.prototype;
e.Bg=function(a){0>a&&(a=0);100<a&&(a=100);this.qk?(this.Zf=a-this.Ab,ig(this.yc,this.Zf)):(this.fh||(100===a&&this.Cq?ni(this):ig(this.Fa,a)),this.Ab=a)};e.wh=function(){return this.Ab};e.Dr=function(){ni(this)};
e.Y=function(a){hg(this.Fa,a);var b=this.Fa.N();b!==this.Ag&&(this.e.hc=!0,this.Ag=b);hg(this.yc,a);var c=this.yc.N();c!==this.Aj&&(this.e.hc=!0,this.Aj=c);this.fh&&(this.Wf+=a,this.Wf>=this.ok?100===this.Ab?(this.fh=!1,ni(this)):(this.fh=!1,this.pk=0,this.Fa.sh=0,this.Fa.sm=0,ig(this.Fa,this.Ab)):this.pk=(-Math.cos(this.Wf/this.ok*5*Math.PI*2)+1)/2,this.e.hc=!0);b+=c;if(this.bn)for(a=0;a<this.J.length;++a)c=b>=this.J[a].position&&this.Ab+this.Zf>=this.J[a].position,this.J[a].complete!==c&&(this.a.J&&
(this.e.hc=!0,this.Ag=b),this.J[a].complete=c)};e.Zk=function(a,b){this.md&&hi(this.x+this.M.Xb+a-this.md.$a,this.y+this.M.Yb+b-this.md.Ua,this.md.width*this.M.scale,this.md.height*this.M.scale)};
e.ya=function(a,b){var c,d;if(this.md){d=this.Fa.N()/100;d=Math.max(d,0);d=Math.min(d,1);var f=m.context,h=this.md.width/2-N(4),k=f.fillStyle;if(0<this.yc.N()){var l=this.yc.N()/100;f.beginPath();f.arc(this.x+a,this.y+b,h,.5*-Math.PI+2*d*Math.PI,2*(d+l)*Math.PI-.5*Math.PI,!1);f.lineTo(this.x+a,this.y+b);f.fillStyle=this.Eq;f.fill()}f.beginPath();f.arc(this.x+a,this.y+b,h,.5*-Math.PI,2*d*Math.PI-.5*Math.PI,!1);f.lineTo(this.x+a,this.y+b);f.fillStyle=this.color;f.fill();this.ok&&(l=f.globalAlpha,f.globalAlpha*=
this.pk,f.beginPath(),f.arc(this.x+a,this.y+b,h,.5*-Math.PI,2*d*Math.PI-.5*Math.PI,!1),f.lineTo(this.x+a,this.y+b),f.fillStyle=this.Bq,f.fill(),f.globalAlpha=l);if(this.a.J){var l=f.strokeStyle,n=f.lineWidth;f.strokeStyle="white";f.lineWidth=N(2);for(d=0;d<this.J.length;++d){c=this.J[d];c=c.position/100*Math.PI*2;var q=Math.cos(-.5*Math.PI+c)*h;c=Math.sin(-.5*Math.PI+c)*h;f.beginPath();f.moveTo(Math.round(a+this.x),Math.round(b+this.y));f.lineTo(Math.round(a+this.x+q),Math.round(b+this.y+c));f.stroke()}f.strokeStyle=
l;f.lineWidth=n}this.md.o(0,a+this.x,b+this.y);if(this.a.J)for(d=0;d<this.J.length;++d)c=this.J[d],h=c.complete?s_star_filled:s_star_empty,c=c.position/100*Math.PI*2,h.o(0,Math.round(a+this.x+Math.cos(-.5*Math.PI+c)*this.a.J.nb*.5),Math.round(b+this.y+Math.sin(-.5*Math.PI+c)*this.a.J.nb*.5));f.fillStyle=k}};M.version=M.version||{};M.version.game_ui="2.1.0";
var Th={background:{b:vd},bp:{b:ud,ve:wd,x:N(116),y:N(90)},buttons:{pauseButton:{x:N(530),y:N(12),ea:0}},Ws:{x:N(120),y:N(12),uc:N(400),Dc:N(46),Ff:.2,pm:50,Bm:!1,separator:"",font:Ve,rh:{fillColor:"#172348",fontSize:N(42)}},kt:{x:N(18),y:N(18),uc:N(86),Dc:N(50),Ff:.2,Bm:!0,separator:"\n",oh:"STAGE",font:Ue,rh:{fillColor:"#799EC5"}},Mr:{x:N(254),y:N(64),uc:N(270),Dc:N(20),Ff:.2,pm:50,Bm:!0,separator:": ",font:Te,rh:{fillColor:"#5E83B0",fontSize:N(16),align:"left",i:"bottom"}},Pr:{x:N(232),y:N(74),
b:yd,ag:!0},Jr:{x:N(36),y:N(86),b:xd,ag:!0},ps:{x:N(56),y:N(76),uc:N(50),Dc:N(24),Ff:.2,Bm:!1,separator:"x ",font:Ue,rh:{align:"left",i:"middle",fillColor:"#5782AE"}},mf:{x:N(36),y:N(86),b:null,ag:!0},Yd:{x:N(56),y:N(76),uc:N(50),Dc:N(24),Ff:.2,font:Ue,rh:{align:"left",i:"middle",fillColor:"#5782AE"}}};
function oi(a,b,c,d,f){var h=0;this.visible=this.h=!1;this.group=0;this.node=a;this.attributes=b;this.duration=c;this.Db=f;this.iv=d;this.Bk=0;this.Vf={};for(h in this.attributes)this.Vf[h]=a[h];this.Zq={};for(h in this.attributes)this.Zq[h]=this.attributes[h]-this.Vf[h];J(this)}oi.prototype.finish=function(){this.h=!1;K(I,this);for(i in this.attributes)this.node[i]=this.attributes[i];"undefined"!==typeof this.Db&&this.Db()};
oi.prototype.Y=function(a){var b=0,c,d,f;this.Bk+=a;if(this.Bk<this.duration)for(b in this.attributes)a=this.Zq[b],c=this.Bk,d=this.Vf[b],f=this.duration,this.node[b]=this.iv(c,d,a,f);else this.finish()};oi.prototype.start=function(){this.h=!0};oi.prototype.pause=function(){this.h=!1};function pi(){return function(a,b,c,d){return 4*oc(a,b,c,d)}}function qi(a,b,c,d,f){this.$e(a,b,c,d,f)}function ri(a,b,c){a.Xc=b;a.od=.5;a.Hc=c;a.Dx=a.Xc+a.od+a.Hc}
qi.prototype.$e=function(a,b,c,d,f,h){this.depth=100;this.h=this.visible=!0;this.group="gameObject";this.x=c;this.y=d;this.K=null;this.state=0;this.alpha=1;this.font=b.P();this.sb=0;this.text=a;this.Rb=f;si(this,h);this.duration=500;ri(this,.25,.06);this.Rb&&G.play(this.Rb);this.ac=this.$b=1;M.d.Ja(this,M.th);J(this);Rb(this,"game")};var ti={};
function si(a,b){ti.hasOwnProperty(a.font.H)||(ti[a.font.H]={});var c=""+a.font.fontSize;ti[a.font.H].hasOwnProperty(c)||(ti[a.font.H][c]={});ti[a.font.H][c].hasOwnProperty(a.font.fillColor)||(ti[a.font.H][c][a.font.fillColor]={});ti[a.font.H][c][a.font.fillColor].hasOwnProperty(a.font.strokeColor)||(ti[a.font.H][c][a.font.fillColor][a.font.strokeColor]={});if(ti[a.font.H][c][a.font.fillColor][a.font.strokeColor].hasOwnProperty(a.text))a.K=ti[a.font.H][c][a.font.fillColor][a.font.strokeColor][a.text];
else{a.K=new r(Math.floor(1.2*a.font.$(a.text)),Math.floor(1.2*a.font.U(a.text))+N(10));b||(ti[a.font.H][c][a.font.fillColor][a.font.strokeColor][a.text]=a.K);c=a.K;x(c);try{F(a.font,"middle"),E(a.font,"center"),a.font.o(a.text,c.width/2,c.height/2)}finally{y(c)}}}qi.prototype.jb=function(){this.canvas.W=!0};qi.prototype.Y=function(a){this.sb+=a;this.sb>this.duration&&K(I,this);this.canvas.W=!0;this.Zj(a)};qi.prototype.Zj=function(){};
qi.prototype.ya=function(){this.K.S(this.x-this.K.width*this.$b/2,this.y-this.K.height*this.ac/2,this.$b,this.ac,0,this.alpha)};function ui(a,b,c,d,f,h){this.$e(a,b,c,d,f,h);this.duration=500;ri(this,.25,.06);a=vc([rc,ic,pi()],[!1,!1,!1],[this.Xc,this.od,this.Hc]);this.Gd=new gg(0,this.duration,a);ig(this.Gd,2);a=vc([rc,ic,mc],[!1,!1,!0],[this.Xc,this.od,this.Hc]);this.Hd=new gg(0,this.duration,a);ig(this.Hd,1)}fg(qi,ui);
ui.prototype.Zj=function(a){hg(this.Gd,a);hg(this.Hd,a);this.$b=this.Gd.N();this.ac=this.Hd.N();this.sb>this.duration*(1-this.Hc/this.Dx)&&(this.font.setFillColor("white"),this.font.setStrokeColor("white"),si(this))};
function vi(a,b,c,d,f,h,k,l,n){this.$e(a,b,M.zd+M.kd/2,M.Ad+M.bj/2+(n||0),f,l);this.font.setFillColor("white");this.font.setStrokeColor("white");a=Na(this.font);a.color="white";Ma(this.font,a);this.depth=-20;this.duration=2E3;ri(this,.1,.3);k=k?oc:rc;a=vc([k,ic],[!1,!1],[this.Xc,this.od+this.Hc]);this.Gd=new gg(0,this.duration,a);ig(this.Gd,1);k=vc([k,ic],[!1,!1],[this.Xc,this.od+this.Hc]);this.Hd=new gg(0,this.duration,k);ig(this.Hd,1);k=vc([ic,oc],[!1,!1,!0],[this.Xc+this.od,this.Hc]);this.Tf=new gg(1,
this.duration,k);ig(this.Tf,0);k=vc([ic,qc],[!1,!1],[this.Xc+this.od,this.Hc]);this.zg=new gg(this.y,this.duration,k);ig(this.zg,this.y);var q=vc([ic,oc],[!1,!1,!0],[this.Xc+this.od-.2,this.Hc+.2]),u=this;h=h||.75;new wi(c,u.duration,xi(u.x-u.K.width/2,u.y-u.K.height/8,u.K.width,u.K.height/4),N(50),d,function(a){return q(a,h,-h,u.duration)})}fg(qi,vi);
vi.prototype.Zj=function(a){hg(this.Gd,a);hg(this.Hd,a);hg(this.Tf,a);hg(this.zg,a);this.$b=this.Gd.N();this.ac=this.Hd.N();this.alpha=this.Tf.N();this.y=this.zg.N()};vi.prototype.ya=function(){this.K.S(this.x-this.K.width*this.$b/2,this.y-this.K.height*this.ac/2,this.$b,this.ac,0,this.alpha)};
function yi(a,b,c,d,f,h){this.$e(a,b,M.zd+M.kd/2,M.Ad+M.bj/2,f,h);this.font.setFillColor("white");this.font.setStrokeColor("white");a=Na(this.font);a.color="white";Ma(this.font,a);this.depth=-20;this.duration=2E3;ri(this,.5,.3);a=vc([oc,ic],[!1,!1],[this.Xc,this.od+this.Hc]);this.Gd=new gg(0,this.duration,a);ig(this.Gd,1);a=vc([oc,ic],[!1,!1],[this.Xc,this.od+this.Hc]);this.Hd=new gg(0,this.duration,a);ig(this.Hd,1);a=vc([ic,oc],[!1,!1,!0],[this.Xc+this.od,this.Hc]);this.Tf=new gg(1,this.duration,
a);ig(this.Tf,0);a=vc([ic,qc],[!1,!1],[this.Xc+this.od,this.Hc]);this.zg=new gg(this.y,this.duration,a);ig(this.zg,this.y)}fg(qi,yi);yi.prototype.Zj=function(a){hg(this.Gd,a);hg(this.Hd,a);hg(this.Tf,a);hg(this.zg,a);this.$b=this.Gd.N();this.ac=this.Hd.N();this.alpha=this.Tf.N();this.y=this.zg.N()};yi.prototype.ya=function(){this.K.S(this.x-this.K.width*this.$b/2,this.y-this.K.height*this.ac/2,this.$b,this.ac,0,this.alpha)};
function xi(a,b,c,d){var f=2*c+2*d,h=c/f,k=d/f;return function(f){if(f<h)return new g(a+1/h*c*f,b);if(f<h+k)return new g(a+c,b+1/k*(f-h)*d);if(f<h+k+h)return new g(a+c-1/h*(f-h-k)*c,b+d);if(1>=f)return new g(a,b+d-1/k*(f-h-k-h)*d)}}function zi(){this.Ih=new g(0,0);this.Qj=new g(0,0);this.Vs=this.na=this.Vq=this.rk=this.os=0}zi.prototype.uo=function(a){return this.rk<a&&this.rk+this.os>a};
function wi(a,b,c,d,f,h){this.b=a;this.visible=this.h=!0;this.Cu=h||function(){return 1};this.depth=0;this.group="gameObject";this.scale=25/a.width;this.hx=f;this.Eh=[];this.yk=b;this.Wq=1;this.Fy=10;this.$x=d;this.sb=0;this.shape=c;M.d.Ja(this,M.th);this.xe=new g(0,0);for(a=0;a<f;++a)b=c(a/f),this.xe.x+=b.x,this.xe.y+=b.y;this.xe=this.xe.scale(1/f);for(a=0;a<f;++a)this.Eh.push(new zi),Ai(this,a);vc([L,L],[!1,!0],[1,1]);J(this);Rb(this,"game")}var Bi=new ga(0);
function Ai(a,b){var c=a.Eh[b],d=b/a.hx;c.os=a.yk;d=a.shape(d);d=d.add(ea(Bi.random(360),Bi.random(a.$x)));c.Vs=360;c.Qj=d.dc(a.xe).scale(1/(a.yk/1E3*.04));c.rk=a.sb+Bi.random(a.Fy);c.Pv=ha(Bi,a.b.D-1);c.Ih=a.xe}
wi.prototype.Y=function(a){this.sb+=a;for(var b=new g(0,180),c=0;c<this.Eh.length;++c){var d=this.Eh[c],f=Math.floor((this.sb-d.rk)/this.yk);f>d.Vq&&f<this.Wq-1&&(Ai(this,c),d.Vq=f);d.uo(this.sb)&&(f=d.Qj.scale(-4),f=b.add(f),d.Qj=d.Qj.add(f.scale(a/1E3)),d.Ih=d.Ih.add(d.Qj.scale(a/1E3)),d.na+=d.Vs*a/1E3,d.scale=2*Math.log(d.Ih.dc(this.xe).length()/100)*this.scale)}this.sb>this.yk*this.Wq&&K(I,this);this.canvas.W=!0};
wi.prototype.ya=function(){for(var a=0;a<this.Eh.length;++a){var b=this.Eh[a];b.uo(this.sb)&&this.b.S(b.Pv,b.Ih.x,b.Ih.y,b.scale,b.scale,b.na,.9*this.Cu(this.sb))}};function Ci(a,b){this.x=a;this.y=b}e=Ci.prototype;e.add=function(a){this.x+=a.x;this.y+=a.y};e.dc=function(a){this.x-=a.x;this.y-=a.y};e.scale=function(a){this.x*=a;this.y*=a};e.rotate=function(a){var b=Math.sin(a*Math.PI/180);a=Math.cos(a*Math.PI/180);this.x=a*this.x+b*this.y;this.y=-b*this.x+a*this.y};
e.fg=function(a){return this.x*a.x+this.y*a.y};e.normalize=function(){var a=Math.sqrt(this.x*this.x+this.y*this.y);0===a?this.y=this.x=0:(this.x/=a,this.y/=a)};e.oc=function(a,b,c){var d=Math.min(8,this.length()/4),f=this.dc(this.normalize().scale(2*d)),h=f.add(fa(this).scale(d)),d=f.add(fa(this).scale(-d)),k=m.context;k.strokeStyle=c;k.beginPath();k.moveTo(a,b);k.lineTo(a+f.x,b+f.y);k.lineTo(a+h.x,b+h.y);k.lineTo(a+this.x,b+this.y);k.lineTo(a+d.x,b+d.y);k.lineTo(a+f.x,b+f.y);k.stroke()};
function Di(a,b){return"object"===typeof a?new g(a.x+M.zd,a.y+M.Ad):new g(a+M.zd,b+M.Ad)}function Ei(a,b){return M.k.I(a,b||"<"+a+">")}function Fi(){ec.call(this);this.group="gameObject";this.je=[];Rb(this,"game")}fg(ec,Fi);function Gi(a){this.Hs=a;this.Dl=[];this.expansion=1}Gi.prototype.create=function(){0>=this.Dl.length&&(this.expansion=Math.round(1.2*this.expansion)+1,this.expand(this.expansion));var a=this.Dl.pop();this.Hs.apply(a,arguments);return a};Gi.prototype.release=function(a){this.Dl.push(a)};
Gi.prototype.expand=function(a){for(var b=0;b<a;b++)this.Dl.push(new this.Hs)};var Hi=new Gi(Ci);M.version=M.version||{};M.version.game="1.2";var $={};function Ii(){this.depth=11;this.h=this.visible=!0;M.d.Ja(this,M.jf);this.a=M.a.j.j;this.scrollTo=0;J(this);Rb(this,"game");$={e:this};$.Sz=new Jh("gameObject");$.Gq=new Ji;$.oB=[];this.Tu={};this.pp={};$.pb=0;Ki(this);this.xc=0}e=Ii.prototype;
e.Um=function(a){$.pc.Um(a);this.Hh+=a;if(this.mb&&($.pc.Bg(100*this.Hh/$.r.r.Fd),100<=$.pc.wh())){M.l.Px&&M.l.Px();this.mb=!1;var b=this;Li(this,Ei("bs_stage","Stage")+" "+($.pc.Ph.N()+1),Mf);(new oi(null,[],300,L,function(){b.Hh-=$.r.r.Fd;var a,d=$.pc;"undefined"===typeof a&&(a=1);ci(d,d.Ph.N()+a);Mi($.pc.Ph.N());ig(b.hn,Ni());$.pc.Bg(0);$.pc.Bg(100*b.Hh/$.r.r.Fd);b.mb=!0})).start()}};
function Oi(a){a>=M.a.j.Oe.bubbles.length&&(a=M.a.j.Oe.bubbles.length-1);for(1>a&&(a=1);1<=a;--a)if(null!==M.a.j.Oe.bubbles[a])return M.a.j.Oe.bubbles[a]}
function Pi(a,b,c,d,f,h,k,l,n,q,u){var B=Di(f,h),C=750;d&&(C*=4);a.V(b,function(){D(c,k);d?new ui("+"+n,c,B.x,B.y,uf,q):Kh(c,(d?"+":"")+n,B.x,B.y,-N(20),C+10*n,void 0,q);D(c,l)});b+=700;1<u&&(a.V(b,function(){D(c,1*k);new ui("x"+u,c,B.x,B.y,Jf);D(c,l)}),b+=700,a.V(b,function(){D(c,1*k);G.play(vf);"undefined"!==typeof Yd?new Qi(f,h,3,Yd,500,1,0):(new Qi(f,h,3,Od,400,3,0),new Qi(f+N(20),h,3,Od,400,3,22.5),new Qi(f+N(20),h,3,Od,400,3,45));Kh(c,"+"+n*u,B.x,B.y,-N(20),C+10*n,rc,q);D(c,l)}),b+=300);return b}
function Ri(a,b,c,d,f,h,k){for(var l=0,n=0;n<d;++n)l+=Oi(f-n);k="undefined"===typeof k?0:k;f=1;h&&(f=M.a.j.Oe.Zv);$.e.Um(l*f);if(0<l||0<k){var n=Ze,q=a.Tu;h&&(n=af);var u=n.fontSize,B=Math.floor(h?n.fontSize+Math.min((l-10)/10,2*n.fontSize):u),C=new Fi,t=1;n===af&&(a.pp.hasOwnProperty(""+B)||(a.pp[""+B]={}),q=a.pp[""+B]);0<l&&(t=Pi(C,t,n,h,b,c,B,u,l,q,f));b=l*f+k;a.sr&&K(I,a.sr);M.a.j.zy.Vx&&(a.sr=Kh(n,"["+b+"]",50,50,-N(20),5E3,rc,q));(h||0===d)&&b>=M.a.j.Oe.et&&(b>=M.a.j.Oe.Wx?(C.V(t+a.xc,function(){new vi(Ei("bs_awesome"),
ef,Jd,50,wf)}),a.xc+=t+2E3):b>=M.a.j.Oe.Xx?(C.V(t+a.xc,function(){new vi(Ei("bs_great"),df,Jd,50,wf)}),a.xc+=t+2E3):b>=M.a.j.Oe.et&&(C.V(t+a.xc,function(){new vi(Ei("bs_nice"),cf,Jd,20,wf)}),a.xc+=t+2E3));C.start()}return l*f}function Si(a,b,c,d,f){if(0>=f)return b;if("object"===typeof a&&null!==a&&null!==b){var h;h="undefined"!==typeof a.length?[]:{};for(var k in a)h[k]=Si(a[k],b[k],c,d,f-1);return h}return"number"===typeof a?a*c+b*d:b}
function Mi(a){for(var b=null,c=0;c<M.a.j.zo.length;++c){var d=M.a.j.zo[c];if(d.r.Pc>=a){b&&d.r.Pc!==a?(a=(a-b.r.Pc)/(d.r.Pc-b.r.Pc),$.r=Si(b,d,1-a,a,3),$.r.r.border=d.r.border):$.r=d;break}else b=d}}e.jb=function(){this.mb=!1;this.Fx=!0;this.canvas.W=!0;Vb(function(a){return"gameObject"===a.group});K(I,$.pc);$=null};
function Ki(a){a.mb=!1;$.pc=new Sh({lives:!0});ci($.pc,1);var b=Hh();b||(b=0);bi(b);Mi(1);Ti(Ei("bs_start","Bubbleshooter!"),Ei("bs_shootallbubbles","Shoot all the bubbles...!"),function(){this.mb=!0},a);$.Ea=M.kd/11/2;$.Xa=$.Ea/(ve.width/2);$.background=new Ui;$.ca=new Vi;Wi($.ca,M.a.j.ca.Vv);$.Bc=new Xi;$.Bc.Ci();$.Bc.Tm=!0;$.Bc.xA=M.a.j.j.Ya;a.hn=new gg(Ni(),1E3,tc);a.Hh=0}e.ho=function(){};e.Vb=function(){};e.Y=function(a){this.canvas.W=!0;hg(this.hn,a);this.xc=Math.max(0,this.xc-a)};e.Ob=function(){};
e.Pb=function(){};e.og=function(){};e.pg=function(){};e.Yk=function(a){"LEVELFINISHED"===a&&Yi()};e.Kc=function(){};e.Ge=function(){};function Li(a,b,c){var d=new Fi;d.V(a.xc+1,function(){new vi(b,Ye,Jd,0,c)});a.xc+=2E3;d.start()}function Ni(){return 2*$.Ea+($.r.r.border-1)*$.ca.Ao+N(2)}e.ya=function(){we.o(0,0,this.hn.N())};
function Xi(){this.depth=10;this.h=this.visible=!0;this.group="gameObject";M.d.Ja(this,M.jf);this.a=M.a.j.Bc;this.x=this.a.x;this.y=this.a.y;this.b=Hd;this.Tm=!1;this.alpha=1;this.Ya=$.r.r.Ya;this.mm=this.Ft=0;this.Mi=1;this.rm=0;this.Jj=$e.fillColor;this.Ef=new r(Math.floor(1.2*$e.$("88")),Math.floor(1.2*$e.U("88")));this.vo=-1;var a=N(20);this.kb=Xb(-Id.$a-a,-Id.Ua-a,Id.width+2*a,Id.height+2*a);this.lm=new r(Bd.width,Bd.height);Zi(this);this.X=[];this.random=new ga;J(this);Rb(this,"game")}
function Zi(a){x(a.lm);a.lm.clear();try{Bd.o(0,0+Bd.$a,0+Bd.Ua);var b=Ei("bs_tap_to_switch_bubbles"),c=Va(bf,b,N(180),N(20),!1),d=bf.fontSize;bf.fontSize>c&&D(bf,c);bf.o(Ei("bs_tap_to_switch_bubbles"),N(40),N(16),N(180));D(bf,d)}finally{y(a.lm)}}e=Xi.prototype;
e.Ci=function(){var a,b,c,d,f;f=this.a.scale;for(b=0;b<this.X.length;b++)a=this.X[b],c=this.a.X[b].x*f+this.x,d=this.a.X[b].y*f+this.y,a.moveTo(c,d,this.a.X[b].scale);for(b=0;this.a.X.length!==this.X.length;b++)c=this.a.X[this.X.length].x*f+this.x,d=this.a.X[this.X.length].y*f+this.y,a=$i(c,d),a.scale=this.a.X[this.X.length].scale,this.X.push(a)};e.Vb=function(){this.Xd=new aj(this.x,this.y)};e.jb=function(){for(this.Xd&&K(I,this.Xd);0!==this.X.length;){var a=this.X.pop();K(I,a)}this.Tm=!1};
function bj(a,b,c){b-=M.zd;c-=M.Ad;c>a.y-a.b.Ua&&(c=a.y-a.b.Ua);b-=a.x;c-=a.y+$.pb;c=Hi.create(b,c);c.normalize();a.rotation=Math.min(180*Math.acos(0*c.x+-1*c.y)/Math.PI,a.a.rw)*(0<b?-1:1);Hi.release(c)}
e.Y=function(a){var b,c;b=I.ha[0].x;c=I.ha[0].y;bj(this,b,c);this.y=this.a.y-$.pb;for(var d=0;d<this.X.length;++d){var f=this.X[d];f.Va=this.a.X[d].x+this.x;f.Ka=this.a.X[d].y+this.y;f.position.x=this.a.X[d].x+this.x;f.position.y=this.a.X[d].y+this.y;f.scale=this.a.X[d].scale}if(this.Xd){var d=this.Xd,h=this.rotation,f=-Math.sin(Math.PI*h/180),h=-Math.cos(Math.PI*h/180);d.Cl.x=f;d.Cl.y=h;this.Xd.Wc.x=this.x;this.Xd.Wc.y=this.y}1>=this.Ya?(this.rm+=a,150<this.rm&&(this.Jj="red"===this.Jj?$e.fillColor:
"red",this.vo=-1,this.rm=0)):this.Jj=$e.fillColor;b-=M.zd;c-=M.Ad;c+=$.pb;c=dc(this.kb,this.x,this.y,b,c);this.Xd.visible=!0;this.mm=c||I.ha[0].wb?Math.min(1,this.mm+.003*a):Math.max(0,this.mm-.003*a);c?(this.Mi=Math.min(1,this.Mi+.003*a),this.Xd.visible=!1):this.Mi=Math.max(0,this.Mi-.003*a)};
function cj(a,b){var c,d,f,h;c=a.X.indexOf(b);if(-1!==c)for(G.play(If),++a.Ft,a.X[0]=a.X.splice(c,1,a.X[0])[0],"function"===typeof a.X[0].Zo&&a.X[0].Zo(),c=0;c<a.X.length;c++)b=a.X[c],d=a.a.X[c].x+a.x,f=a.a.X[c].y+a.y,h=a.a.X[c].scale,b.moveTo(d,f,h)}e.og=function(a){32===a&&cj(this,this.X[1])};
e.Pb=function(a,b,c){if(0===a&&!0===$.e.mb){a=!0;var d="object"===typeof b?new g(b.x-M.zd,b.y-M.Ad):new g(b-M.zd,c-M.Ad);d.y+=$.pb;dc(this.kb,this.x,this.y,d.x,d.y)&&(a=!1);if(!0===a&&!0===this.Tm){bj(this,b,c);b=this.X.shift();b.ct(this.rotation);b.vy=!0;c=$.Gq;for(var f in c.fb)c.fb[f]=Math.max(0,c.fb[f]-1);this.Ss=b;$.Bc.Ci()}else cj(this,this.X[1])}};function dj(){var a=$.Bc;a.Ya--;0>=a.Ya&&(a.Ya=$.r.r.Ya,$.ca.Ah++)}e.Kc=function(a){a===M.of&&Zi(this)};
e.ya=function(){Id.S(0,this.x,this.y+$.pb,1*$.Xa,1*$.Xa,0,this.alpha);this.b.S(0,this.x,this.y+$.pb,1*$.Xa,1*$.Xa,this.rotation,this.alpha*(1-this.Mi));var a=this.a.Su;if(this.vo!==this.Ya){x(this.Ef);try{1!==this.Ya&&(this.Jj=$e.fillColor);this.Ef.clear();var b=$e.fillColor;$e.setFillColor(this.Jj);$e.o(""+this.Ya,this.Ef.width/2,this.Ef.height/2);$e.setFillColor(b);this.vo=this.Ya}finally{y(this.Ef)}}this.Ef.o(a.x+this.x-this.Ef.width/2,a.y+this.y-this.Ef.height/2);10>=this.Ft&&this.lm.S(this.x+
N(35,"floor")-Bd.$a,this.y+N(24,"floor")+$.pb-Bd.Ua,1,1,0,this.mm)};function ej(a,b,c){fj(this,a,b,c)}ej.kb=new Yb(0,0,ve.width/2);function fj(a,b,c,d){a.depth=4;a.visible=!0;a.h=!1;a.group="gameObject";M.d.Ja(a,M.jf);a.position=new g(b,c);a.Va=a.position.x;a.Ka=a.position.y;a.alpha=1;a.speed=0;a.scale=1;a.b=ve;a.size=ve.width/2;a.type=d;a.kb=ej.kb;a.Qb=!1;a.vy=!0;a.direction=new g(0,-1);a.je=["bubble"];a.xl=0;J(a);Rb(a,"game")}e=ej.prototype;e.jb=function(){};
function gj(a){var b;a.ia("game");b=new oi(a,{scale:1.1},300,L,function(){b=new oi(a,{scale:1},300,L,function(){a.ia("background")});b.group="gameObject";b.start()});b.group="gameObject";b.start()}function hj(a,b){a.direction.x=-Math.sin(Math.PI*b/180);a.direction.y=-Math.cos(Math.PI*b/180)}e.Km=function(){this.speed=$.Xa*$.r.ba.speed};e.ct=function(a){G.play(Hf);hj(this,a);this.Km();this.h=!0};e.ia=function(){};e.bl=function(){$.ca.Ci(this);this.speed=0;this.h=!1;return!0};
function ij(a,b,c){var d;c="undefined"!==typeof c?c:!0;a.ia("game");b*=a.speed;for(var f=0;f<b;){f+=1;a.position.x+=1*a.direction.x;a.position.y+=1*a.direction.y;a.Va=a.position.x;a.Ka=a.position.y;var h=[];c&&a.position.x<a.size?h.push(new g(-a.direction.x,a.direction.y)):c&&a.position.x>M.kd-a.size&&h.push(new g(-a.direction.x,a.direction.y));if(a.position.y>M.bj+a.size-$.pb){a.remove();break}if(0<h.length){var k=new g(0,0);for(d=0;d<h.length;++d)k=k.add(h[d]);0===k.length()&&console.log("bounceDirectionAverage is 0");
k=k.normalize();a.direction=k}if(d=!a.Qb)d=$.ca,h=void 0,a.position.y<$.Ea?d=!0:(h=jj(d,a.position.x,a.position.y),d=!1!==kj(d,h.Ha,h.position)?!0:!1),d=!0===d;if(d&&a.bl())break}}e.Y=function(a){ij(this,a)};
function lj(a,b,c){var d;!1===a.Qb&&("undefined"!==typeof a.ka&&K(I,a.ka),a.ia("game"),d=M.a.j.oa.Pu,c=(new g(b,c)).dc(new g(a.position.x,a.position.y)).normalize().scale(d),b=a.position.x-c.x,c=a.position.y-c.y,a.ka=new oi(a,{Va:b,Ka:c},M.a.j.oa.Hq/2,tc,function(){a.ka=new oi(a,{Va:a.position.x,Ka:a.position.y},M.a.j.oa.Hq/2,tc,function(){!1===a.Qb&&a.ia("background")});a.ka.group="gameObject";a.ka.start()}),a.ka.group="gameObject",a.ka.start())}
function mj(a,b){!1===a.Qb&&("undefined"!==typeof a.ka&&K(I,a.ka),a.ia("game"),a.Va=a.position.x,a.Ka=a.position.y,a.position.y+=b,a.ka=new oi(a,{Ka:a.position.y,Va:a.position.x},M.a.j.oa.Rw,tc,function(){!1===a.Qb&&a.ia("background");nj(a)}),a.ka.group="gameObject",a.ka.start())}
function nj(a){if(a.position.y+$.Ea>Ni()){var b=$.e;if(b.mb){var c=$.e;if(c.mb){c.mb=!1;var d=I,f=1,h=d.ec.length,k;void 0===f&&(f=1);void 0===c&&(c=null);for(k=0;k<d.ec.length;k+=1)"LEVELFINISHED"===d.ec[k].id&&d.ec[k].Hf===c&&(h=k);if(h===d.ec.length)for(k=0;k<d.ec.length;k+=1)void 0===d.ec[k].id&&(h=k);d.ec[h]={id:"LEVELFINISHED",time:3E3,pB:f,Hf:c,Ng:3E3,Xl:f-1,paused:0}}Li(b,Ei("bs_gameover","Game over!"))}a.xl||(a.xl=I.vh)}}
e.moveTo=function(a,b,c){var d;!1===this.Qb&&("undefined"!==typeof this.ka&&K(I,this.ka),this.ia("game"),this.position.x=a,this.position.y=b,a="undefined"!==typeof c?c:this.scale,d=this,this.ka=new oi(this,{Va:this.position.x,Ka:this.position.y,scale:a},M.a.j.oa.Al,L,function(){!1===d.Qb&&d.ia("background")}),this.ka.group="gameObject",this.ka.start())};
function oj(a,b){var c,d,f;!1===a.Qb&&(c=jj($.ca,a.position.x,a.position.y),"undefined"!==typeof $.ca.G[c.Ha][c.position]&&(a.ia("game"),a.Qb=!0,Qb(a,0),d=new ej(a.position.x,a.position.y,b),gj(d),f=new oi(a,{alpha:0},600,L),f.group="gameObject",f.start(),f=new oi(a,{scale:1.1},300,L,function(){f=new oi(a,{scale:1},300,L,function(){a.remove()});f.group="gameObject";f.start()}),f.group="gameObject",f.start(),$.ca.G[c.Ha][c.position]=d))}
e.pop=function(){var a,b;!1===this.Qb&&(this.ia("game"),Qb(this,3),this.Qb=!0,"undefined"!==typeof this.ka&&K(I,this.ka),a=new oi(this,{Va:this.position.x,Ka:this.position.y},M.a.j.oa.Al,L),a.group="gameObject",a.start(),b=this,a=new oi(this,{scale:M.a.j.oa.tx},M.a.j.oa.sx,pc,function(){K(I,b);new Qi(b.position.x,b.position.y,b.depth,Od,M.a.j.oa.yj,1)}),a.group="gameObject",a.start())};
e.Wi=function(){if(!1===this.Qb){var a,b;this.ia("game");Qb(this,3+Ed.D);this.Qb=!0;"undefined"!==typeof this.ka&&K(I,this.ka);a=new oi(this,{Va:this.position.x,Ka:this.position.y},M.a.j.oa.Al,L);a.group="gameObject";a.start();b=this;a=new oi(this,{scale:M.a.j.oa.In},M.a.j.oa.Mk,pc,function(){K(I,b);new Qi(b.position.x,b.position.y,b.depth,Kd,M.a.j.oa.Lk,1)});a.group="gameObject";a.start()}};
e.Gh=function(){switch(this.type){case 0:G.play(Bf);break;case 1:G.play(Cf);break;case 2:G.play(Df);break;case 3:G.play(Ef);break;case 4:G.play(Ff);break;case 5:G.play(Gf)}};
function pj(a){var b;!1===a.Qb&&(a.ia("game"),Qb(a,3),a.Qb=!0,"undefined"!==typeof a.ka&&K(I,a.ka),b=M.a.j.oa.qv,a.position.x+=Math.random()*b-b/2,a.position.y+=M.bj,b=new oi(a,{Ka:a.position.y},M.a.j.oa.or,sc,function(){K(I,a)}),b.group="gameObject",b.start(),b=new oi(a,{Va:a.position.x},M.a.j.oa.or,L),b.group="gameObject",b.start())}e.remove=function(){this.ia("game");K(I,this);this.Qb=!0};
function qj(a){0<a.xl&&Nd.S(0,a.position.x,a.position.y+$.pb,a.scale*$.Xa,a.scale*$.Xa,0,(Math.sin((I.vh-a.xl)/1E3*Math.PI*2)+1)/2)}e.Yg=function(a,b){qj(this);this.b.S(this.type,a,b+$.pb,this.scale*$.Xa,this.scale*$.Xa,0,this.alpha)};e.ya=function(){0!==this.speed||this.h||this.Va!==this.position.x||this.Ka!==this.position.y||(this.Va=this.position.x,this.Ka=this.position.y);this.Yg(this.Va,this.Ka)};
function Ui(){this.depth=-9E3;this.h=this.visible=!1;this.group="gameObject";var a=Di(0,0);this.x=a.x-N(6);this.y=a.y;this.gn=[];M.d.Ja(this,M.lg);J(this);Rb(this,"game")}Ui.prototype.Y=function(){};Ui.prototype.Vb=function(){m.ia(this.canvas)};Ui.prototype.Ci=function(a){this.gn.push(a);m.ia(this.canvas);a.ya()};Ui.prototype.wf=function(a){a=this.gn.indexOf(a);-1!==a&&this.gn.splice(a,1);this.h=!0};function rj(a,b,c){this.Ha=a;this.position=b;c&&(this.ba=c)}
function Vi(){this.depth=9E3;this.visible=!0;this.h=!1;this.group="gameObject";this.G=[];this.ae=1;this.Ah=this.cf=0;this.random=new ga;M.d.Ja(this,M.lg);this.Ao=Math.sqrt(Math.pow(2*$.Ea,2)-Math.pow($.Ea,2));this.Pn=[];J(this);Rb(this,"game")}e=Vi.prototype;e.Vb=function(){};e.jb=function(){};e.ya=function(){hi(M.zd,M.Ad,M.kd,M.bj);for(var a=0;a<this.G.length;++a)for(var b=this.G[a],c=0;c<b.length;++c){var d=b[c];d&&d.Gz&&d.Yg(d.Va+M.zd,d.Ka+M.Ad)}};
function sj(a){for(var b=[0,0,0,0,0,0],c=0;c<a.G.length;++c)for(var d=a.G[c],f=0;f<d.length;++f){var h=d[f];h&&5>=h.type&&0<=h.type&&b[h.type]++}return b}
function tj(a,b){b=b||2;var c;c=$.Bc;c=0<c.X.length?c.X[0].type:void 0;for(var d=$.Bc.Ss?$.Bc.Ss.type:null,f=a.G.length;0<=f;--f)for(var h=a.G[f],k=Math.floor(M.kd/(2*$.Ea))-(f%2===a.ae?0:1),l=0;l<k;++l){var n=Math.floor((k-1)/2)+Math.ceil(l/2)*(1-(l+1)%2*2);if(!h||!h[n]){for(var q=new rj(f,n,null),q=uj(a,q.Ha,q.position,[q.ba]),u=[],B=0,C=-1,t=0;t<q.length;++t){var s=q[t].ba;s&&5>=s.type&&0<=s.type&&s.type!==c&&s.type!==d&&("undefined"===typeof u[s.type]&&(u[s.type]=vj(a,f,n,s.type,[],!0)),u[s.type]>=
B&&(C=s.type,B=u[s.type]))}if(B>=b)return C}}return 1<b?tj(a,1):wj(new xj)}function jj(a,b,c){c=Math.round((c-$.Ea)/a.Ao);c=Math.max(c,0);c%2===a.ae?(a=Math.round((b-$.Ea)/(2*$.Ea)),a=Math.max(Math.min(a,Math.floor(M.kd/(2*$.Ea))-1),0)):(a=Math.round((b-2*$.Ea)/(2*$.Ea)),a=Math.max(Math.min(a,Math.floor(M.kd/(2*$.Ea))-2),0));return new rj(c,a)}function yj(a,b,c){return{x:c*$.Ea*2+$.Ea*(b%2===a.ae?1:2),y:b*a.Ao+$.Ea}}
function zj(a){var b,c,d;for(b=0;b<a.G.length;b++){c=a.G[b];d=!0;for(var f=0;f<c.length;f++)"undefined"!==typeof c[f]&&(d=!1);if(!0===d)return b}return a.G.length}function Aj(a){var b,c,d,f,h;f=[];for(b=0;b<a.G.length;b++)for(d=a.G[b],c=0;c<d.length;c++)h=d[c],"undefined"!==typeof h&&f.push({ba:h,Ha:b,position:c});return f}function kj(a,b,c){return"undefined"!==typeof a.G[b]&&"undefined"!==typeof a.G[b][c]?a.G[b][c]:!1}
function Wi(a,b){var c,d,f,h,k,l,n,q;d=Math.sqrt(Math.pow(2*$.Ea,2)-Math.pow($.Ea,2));var u=new xj;for(h=1;h<=b;h++){a.ae=(a.ae+1)%2;c=Math.floor(M.kd/(2*$.Ea))-a.ae;f=[];n=-d*h+$.Ea;for(k=0;k<c;k++){l=0===a.ae%2?k*$.Ea*2+$.Ea:k*$.Ea*2+2*$.Ea;a:{q=u;for(var B=n,C=$.ca.random.random(q.tm),t=0,s=0;s<q.vd.length;++s)if(t+=q.vd[s],t>C){if(5>=s){q=new ej(l,B,-1);break a}if(6===s){q=new Bj(l,B);break a}}q=void 0}f.push(q)}a.G.splice(0,0,f);for(k=0;k<c;++k)if(q=a.G[0][k],-1===q.type)a:for(f=u,n=k,l=(s=10*
$.r.r.ye>$.ca.random.random(1E3))?1:$.r.r.Ie,B=[],C=0,t=[],q.Yv=s;;){for(var v=$.ca.random.random(f.Sg),w=0,s=0;5>=s;++s)if(w+=f.vd[s],w>v)if("undefined"===typeof B[s]&&(B[s]=vj($.ca,0,n,s)),B[s]>=l){t[s]||(t[s]=!0,C++);break}else{q.type=s;break a}if(C>=f.Py)for(t=[],s=0;s<B.length;++s)B[s]--}}c=Aj(a);for(k=0;k<c.length;k++)q=c[k].ba,mj(q,d*b)}
function vj(a,b,c,d,f,h){var k=0;h=h||!1;b=[new rj(b,c)];for(f=f||[];1<=b.length;){c=b[0];f.push(c.ba);c=uj(a,c.Ha,c.position,f);for(var l=0;l<c.length;l++){var n=c[l];f.push(n.ba);d===n.ba.type&&(n.ba.Yv&&(h||(k+=999999)),b.push(n),++k)}b.splice(0,1)}return k}
function Cj(a,b){var c,d,f,h=null,k=null,l,n;l=[];for(c=0;c<a.G.length;c++)for(d=a.G[c],f=c,n=Math.floor(M.kd/(2*$.Ea))-(f%2===a.ae?0:1),f=0;f<n;f++)Dj(a,c,f)||"undefined"===typeof d[f]&&l.push(new rj(c,f));f=a.G.length;n=Math.floor(M.kd/(2*$.Ea))-(f%2===a.ae?0:1);for(c=0;c<n;c++)Dj(a,a.G.length,c)||l.push(new rj(a.G.length,c));for(c=0;c<l.length;c++)if(d=l[c],0===d.Ha||0<uj(a,d.Ha,d.position).length)if(f=yj(a,d.Ha,d.position),f=b.position.dc(new g(f.x,f.y)).length(),f<h||null===h)h=f,k=d;f=yj(a,
k.Ha,k.position);"undefined"===typeof a.G[k.Ha]&&(a.G[k.Ha]=[]);a.G[k.Ha][k.position]=b;b.moveTo(f.x,f.y);return k}
e.Ci=function(a){var b=0,c,d,f,h,k,l,n,q,u;n=this;this.cf++;u=!0;l=new Fi;l.group="gameObject";d=0;c=Cj(this,a);var B=0;h=Ej(this,c.Ha,c.position);if(3<=h.length){u=!1;for(f=q=0;f<h.length;f++)this.wf(h[f].Ha,h[f].position),++b,++q,d+=M.a.j.oa.qx*Math.pow(f+1,M.a.j.oa.rx),l.V(d,function(a,b){return function(){a.pop();B+=Ri($.e,a.position.x,a.position.y,1,b,!1)}}(h[f].ba,q));10<h.length&&G.play(qf);6<h.length?G.play(tf):6<h.length?G.play(uf):5<h.length?G.play(vf):4<h.length?G.play(wf):a.Gh();var C=
new g(0,0);k=Fj(this);for(f=0;f<k.length;f++)this.wf(k[f].Ha,k[f].position),++b,d+=M.a.j.oa.nr,l.V(d,function(a){return function(){pj(a)}}(k[f].ba)),C=C.add(k[f].ba.position);0<k.length?(C=C.scale(1/k.length),l.V(d,function(){Ri($.e,C.x,C.y,k.length,k.length,!0,B)})):l.V(d,function(){Ri($.e,a.x,a.y,0,0,!1,B)})}else G.play(Af);c=uj(this,c.Ha,c.position);for(f=0;f<c.length;f++)h=c[f].ba,q=c[f].Ha,"bomb"===h.type?(h.Gh(),h.Wi()):q!==this.maxLength-1&&u&&lj(h,a.position.x,a.position.y);l.V(d,function(){n.cf--;
0===n.cf&&Gj(n)});0===b&&(nj(a),dj());l.start()};e.wf=function(a,b){!1!==kj(this,a,b)&&(this.G[a][b]=void 0)};
function uj(a,b,c,d){var f,h,k,l;h=b%2===a.ae?[new rj(b-1,c-1),new rj(b-1,c),new rj(b,c+1),new rj(b+1,c),new rj(b+1,c-1),new rj(b,c-1)]:[new rj(b-1,c),new rj(b-1,c+1),new rj(b,c+1),new rj(b+1,c+1),new rj(b+1,c),new rj(b,c-1)];f=[];for(k=0;k<h.length;k++)b=h[k].Ha,c=h[k].position,"undefined"!==typeof a.G[b]&&"undefined"!==typeof a.G[b][c]&&(l=a.G[b][c],("undefined"!==typeof d?-1===d.indexOf(l):1)&&f.push({ba:l,Ha:b,position:c}));return f}
function Ej(a,b,c){var d,f,h,k,l;h=a.G[b][c];f=[new rj(b,c,h)];d=d||[];for(b=[new rj(b,c,h)];1<=f.length;){c=f[0];d.push(c.ba);k=uj(a,c.Ha,c.position,d);for(c=0;c<k.length;c++)l=k[c],d.push(l.ba),h.type===l.ba.type&&(f.push(l),b.push(l));f.splice(0,1)}return b}
function Fj(a){var b,c,d,f,h,k;if("undefined"===typeof a.G[0])return Aj(a);c=[];b=b||[];f=!0;for(d=0;d<a.G[0].length;d++)h=a.G[0][d],"undefined"===typeof h?f=!0:!0===f&&(f=!1,c.push({ba:h,Ha:0,position:d}));for(;1<=c.length;){d=c[0];b.push(d.ba);h=uj(a,d.Ha,d.position,b);for(d=0;d<h.length;d++)f=h[d],-1===b.indexOf(f.ba)&&(c.push(f),b.push(f.ba));c.splice(0,1)}f=[];for(d=0;d<a.G.length;d++)for(k=a.G[d],c=0;c<k.length;c++)h=k[c],-1===b.indexOf(h)&&"undefined"!==typeof h&&f.push({ba:h,Ha:d,position:c});
return f}function Hj(a){var b,c,d,f,h;h=c=0;f=new Fi;f.group="gameObject";b=Fj(a);for(d=0;d<b.length;d++)a.wf(b[d].Ha,b[d].position),c+=M.a.j.oa.nr,h++,f.V(c,function(a){return function(){pj(a)}}(b[d].ba));f.start();return h}function Gj(a){if(!0===$.e.mb){var b=Math.round($.r.ca.Je/$.Xa),c=zj(a);a.Ah=Math.max(b-c,a.Ah);0<a.Ah&&(Wi(a,a.Ah),a.Ah=0,0<b-c&&($.Bc.Ya=$.r.r.Ya))}}
function Ij(a,b,c){var d=$.ca,f,h,k,l,n,q;d.cf++;l=$.r.gb.nb;n=M.a.j.gb.Jn;k=new Fi;k.group="gameObject";k.Md=n;h=new g(a,b);a=Aj(d);for(b=0;b<a.length;b++)f=a[b].ba,q=h.dc(f.position).length(),q<l&&"bomb"!==f.type&&"blocker"!==f.type&&k.V(q,function(a){return function(){oj(a,c)}}(f));k.V(l+M.a.j.oa.yj*n,function(){d.cf--});k.start()}
function Jj(a,b){var c=$.ca,d,f,h,k,l,n,q,u,B,C,t;c.cf++;u=$.r.Aa.nb;B=M.a.j.Aa.Jn;C=0;q=new Fi;q.group="gameObject";q.Md=B;n=new g(a,b);d=Aj(c);for(f=0;f<d.length;f++)h=d[f].ba,k=d[f].Ha,l=d[f].position,t=n.dc(h.position).length(),0===t&&c.wf(k,l),t<u&&(c.wf(k,l),C++,q.V(t,function(a){return function(){a.Wi()}}(h)));C+=Hj(c);q.V(u+(M.a.j.oa.Lk+M.a.j.oa.Mk)*B,function(){c.cf--;0===c.cf&&Gj(c)});q.start();Ri($.e,a,b,C,C,!0)}
function Dj(a,b,c){"undefined"===typeof a.Pn[b]&&(a.Pn[b]=[]);return!0===a.Pn[b][c]}function Qi(a,b,c,d,f,h,k){this.depth=c;this.h=this.visible=!0;this.group="gameObject";M.d.Ja(this,M.th);this.x=a;this.y=b;this.b=d;this.duration=f;this.scale=h;this.na=0;this.rotation=k||0;J(this);Rb(this,"game");this.m=0}Qi.prototype.Y=function(a){this.m+=a;this.na=this.rotation;this.m>=this.duration&&K(I,this)};
Qi.prototype.ya=function(){var a=Di(this.x,this.y);this.b.S(Math.floor(this.m*this.b.D/this.duration),a.x,a.y+$.pb,this.scale*$.Xa,this.scale*$.Xa,this.na,1)};function Kj(){this.Qa=this.depth=0;this.h=this.visible=!0;J(this);Rb(this,"game")}Kj.prototype.ho=function(){var a,b,c,d;a=[];b=[Pd,Qd,Rd,Sd,Td,Ud,Wd,Xd];for(c=0;c<b.length;c+=1)d=b[c],a.push({b:d,text:M.k.I("TutorialText_"+c,"<TutorialText_"+c+">"),title:M.k.I("TutorialTitle_"+c,"<TutorialHeader_"+c+">")});return a};
function aj(a,b){this.depth=11;this.h=this.visible=!0;this.group="gameObject";M.d.Ja(this,M.jf);this.Wc=new g(a,b);this.Cl=new g(0,-1);this.alpha=0;this.a=M.a.j.Xd;this.G=[];J(this);Rb(this,"game")}
function Lj(a,b){var c,d,f,h,k=null,l;l=$.Ea;c=Aj($.ca);for(d=0;d<c.length;d++)f=c[d].ba,h=new g(f.Va,f.Ka),h=a.dc(h).dc(b.scale(a.dc(h).fg(b))).length(),h<=l&&(null===k||f.Ka>k.Ka?k=f:f.Ka===k.Ka&&Math.abs(f.Va-a.x)<Math.abs(k.Va-a.x)&&(k=f));k?(h=a.dc(new g(k.Va,k.Ka)),c=2*h.fg(b),l=h.fg(h)-Math.pow(l,2),h=Math.pow(c,2)-4*l,l=(-c+Math.sqrt(h))/2,h=(-c-Math.sqrt(h))/2):(l=Math.abs(a.x/b.x),h=Math.abs(a.y/b.y));l=Math.min(l,h);return[b.scale(l).add(a)]}
aj.prototype.Y=function(){this.G=0!==this.alpha&&1===this.a.Kr?[this.Wc].concat(Lj(this.Wc,this.Cl)):[]};aj.prototype.Ob=function(){this.ka&&K(I,this.ka);this.ka=new oi(this,{alpha:1},400,L);this.ka.group="gameObject";this.ka.start()};aj.prototype.Pb=function(){this.ka&&K(I,this.ka);this.ka=new oi(this,{alpha:0},400,L);this.ka.group="gameObject";this.ka.start()};
aj.prototype.ya=function(){var a,b,c,d,f,h;switch(this.a.Kr){case 1:d=m.context;d.lineWidth=this.a.lineWidth;d.strokeStyle="rgba(255, 255, 255, "+.2*this.alpha+")";c=this.a.fv;h=0;for(f=1;f<this.G.length;f++){d.beginPath();d.moveTo(this.G[f-1].x,this.G[f-1].y+$.pb);d.lineTo(this.G[f].x,this.G[f].y+$.pb);for(var k=this.G[f].dc(this.G[f-1]).normalize(),l=this.G[f].dc(this.G[f-1]).length(),n=this.G[f-1];h<l;h+=2*c)d.beginPath(),a=k.scale(h).add(n),b=k.scale(Math.min(l,h+c)).add(n),d.moveTo(a.x,a.y+$.pb),
d.lineTo(b.x,b.y+$.pb),d.stroke();h-=l}2<=this.G.length&&Md.dd(0,this.G[this.G.length-1].x,this.G[this.G.length-1].y+$.pb,this.alpha);break;case 2:Ld.S(0,this.Wc.x,this.Wc.y+$.pb,1,1,this.Cl.direction()-90,this.alpha)}};function Mj(a,b){fj(this,a,b,0);this.h=!0;this.Oq=wj(new xj);this.b=Fd;this.type="blank";this.K=new r(this.b.width,this.b.height);x(this.K);ve.o(this.Oq,this.b.$a,this.b.Ua);this.b.o(0,this.b.$a,this.b.Ua);y(this.K)}fg(ej,Mj);Mj.prototype.Zo=function(){G.play(zf)};
Mj.prototype.bl=function(){Cj($.ca,this);Ij(this.position.x,this.position.y,this.Oq);this.h=!1;this.Gh();return!0};Mj.prototype.Gh=function(){G.play(sf)};Mj.prototype.Yg=function(){this.K.S(this.Va-this.b.$a*this.scale*$.Xa,this.Ka+$.pb-this.b.Ua*this.scale*$.Xa,this.scale*$.Xa,this.scale*$.Xa,0,this.alpha)};function Nj(a,b){fj(this,a,b,0);this.b=Cd;this.type="bomb";this.Hn=!1}fg(ej,Nj);e=Nj.prototype;e.bl=function(){Cj($.ca,this);this.Wi();return!0};
e.Wi=function(){!1===this.Hn&&(this.Gh(),this.h=!1,this.Hn=!0,Jj(this.position.x,this.position.y),this.pop())};
e.pop=function(){var a,b;!1===this.Qb&&(this.Qb=!0,"undefined"!==typeof this.ka&&this.ka.finish(),this.ia("game"),Qb(this,3),a=new oi(this,{Va:this.position.x,Ka:this.position.y},M.a.j.oa.Al,L),a.group="gameObject",a.start(),b=this,a=new oi(this,{scale:M.a.j.Aa.In},M.a.j.Aa.Mk,pc,function(){K(I,b);new Qi(b.position.x,b.position.y,b.depth,Kd,M.a.j.Aa.Lk,M.a.j.Aa.pv)}),a.group="gameObject",a.start())};e.Gh=function(){G.play(rf)};
e.Yg=function(){this.b.S(0,this.Va,this.Ka+$.pb,this.scale*$.Xa,this.scale*$.Xa,0,this.alpha)};function Oj(a,b){fj(this,a,b,"fire");M.d.Ja(this,M.jf);this.depth=1;this.h=!0;this.Zm=this.m=0;this.b=Dd;this.kj=0;this.Ke=!1;null===Pj&&(Pj=new Yb(0,0,this.size*M.a.j.hd.Yu));this.kb=Pj}fg(ej,Oj);var Pj=null;e=Oj.prototype;e.Zo=function(){G.play(xf)};e.Km=function(){this.speed=$.Xa*$.r.ba.speed*M.a.j.hd.Zx};
e.jb=function(){var a,b;a=this;$.e.Fx||(b=new Fi,b.group="gameObject",b.V(M.a.j.hd.Ny,function(){a.kj+=Hj($.ca);Gj($.ca)}),b.start(),Ri($.e,this.position.x,this.position.y+N(80),this.kj,this.kj,!0));$.background.wf(this)};e.ct=function(a){G.play(yf);var b=new Fi;b.group="gameObject";b.V(100,function(){G.play(yf)});b.start();hj(this,a);this.Km();this.Ln=new Qj(this.position.x,this.position.y);this.h=this.Ke=!0};e.bl=function(){return!1};
e.Y=function(a){this.Zm+=a;if(!0===this.Ke){ij(this,a,M.a.j.hd.Qu);(0>this.position.y+N(0)+this.size||0>this.position.x||this.position.x>M.kd)&&K(I,this);for(var b=0;b<a;++b)this.m+=1,this.m>=M.a.j.hd.Ep/Ed.D&&(this.Ln=new Qj(this.position.x,this.position.y),this.m-=M.a.j.hd.Ep/Ed.D);this.Ln.x=this.position.x;this.Ln.y=this.position.y;a=$.ca;var c,d,f,h,k;k=!1;b=Aj(a);for(c=0;c<b.length;c++)d=b[c].ba,f=b[c].Ha,h=b[c].position,!0===bc(d.kb,d.Va,d.Ka,this.kb,this.position.x,this.position.y)&&(d.Wi(),
a.wf(f,h),k=!0);!0===k&&this.kj++}this.canvas.W=!0};e.Yg=function(){var a=new g(this.Va,this.Ka),b=new g(0,0);this.b.S(Math.floor(this.Zm/80)%this.b.D,a.x+b.x,a.y+$.pb+b.y,this.scale*$.Xa,this.scale*$.Xa,0,this.alpha)};function Qj(a,b){this.depth=2;this.h=this.visible=!0;this.group="gameObject";M.d.Ja(this,M.jf);this.na=0;this.Hx=-.2+(new ga).random(.4);this.x=a;this.y=b;this.m=this.index=0;this.scale=M.a.j.hd.scale;this.b=Ed;J(this);Rb(this,"game")}
Qj.prototype.Y=function(a){this.m+=a;this.na+=this.Hx*a;this.m>=M.a.j.hd.Ep/this.b.D&&(this.index+=1,this.m=0,Qb(this,this.depth+1));this.index===this.b.D&&K(I,this)};Qj.prototype.ya=function(){var a=new g(this.x,this.y);this.b.S(this.index,a.x,a.y,this.scale,this.scale,this.na,1)};function xj(){this.vd=Rj($.r.we);this.tm=Sj(this.vd,!1);this.Sg=Sj(this.vd,!0);for(var a=0,b=0;5>=b;++b)0<this.vd[b]&&a++;this.Py=a}
function Tj(a,b){switch(b){case 0:return a.Eb;case 1:return a.Fb;case 2:return a.Gb;case 3:return a.Hb;case 4:return a.Ib;case 5:return a.Jb;case 6:return a.Kb;case 7:return a.Lb;case 8:return a.Mb;case 9:return a.Nb}}function Rj(a){var b=[0,0,0,0,0,0],c;for(c=Math.floor($.pc.wh()/10);0<=c&&!(b=Tj(a,c));--c);return b}function Sj(a,b){var c,d=0;for(c=0;c<(b?6:a.length);++c)a[c]&&(d+=a[c]);return d}function wj(a){for(var b=$.ca.random.random(a.Sg),c=0,d=0;5>=d;++d)if(c+=a.vd[d],c>b)return d}
function Bj(a,b){fj(this,a,b,"blocker");this.b=Gd;this.type="blocker";this.Hn=!1}fg(ej,Bj);Bj.prototype.Yg=function(){qj(this);this.b.S(0,this.Va,this.Ka+$.pb,this.scale*$.Xa,this.scale*$.Xa,0,this.alpha)};function Ji(){this.fb={Aa:0,pn:0,hd:0,all:0}}
function Uj(a,b){var c=5*($.r.r.border-zj($.ca))+$.Bc.Ya;!b&&10>=c?(1===c?a.gc=$.r.rb.me:2===c?a.gc=$.r.rb.ne:3===c?a.gc=$.r.rb.oe:4===c?a.gc=$.r.rb.pe:5===c?a.gc=$.r.rb.qe:6===c?a.gc=$.r.rb.re:7===c?a.gc=$.r.rb.se:8===c?a.gc=$.r.rb.te:9===c?a.gc=$.r.rb.ue:10===c&&(a.gc=$.r.rb.le),a.gc||(a.gc=Rj($.r.rb))):a.gc=Rj($.r.rb);a.tm=Sj(a.gc);$.pc.Ph.N()}
function $i(a,b){var c=$.Gq;Uj(c);for(var d=0;;){for(var f=$.Bc.random.random(c.tm),h=0,k=0;k<c.gc.length;++k)if(h+=c.gc[k],h>=f){if(0===k){c=a;d=b;f=void 0;if(!f){f=void 0;h=$.ca;f=f||sj(h);h=[];for(k=0;k<f.length;++k)0<f[k]&&h.push(k);0===h.length&&h.push(wj(new xj));f=h}f=+f[0+ha($.Bc.random,f.length-1-0)];return new ej(c,d,f)}if(1===k){for(var c=a,d=b,f=new xj,h=sj($.ca),l=0,k=void 0,k=0;6>k;++k)l=Math.max(h[k],l);for(k=0;6>k;++k)0!==h[k]?(h[k]=l-h[k],h[k]*=h[k]):h[k]=0;l=Sj(h,!0);0===l&&wj(f);
for(var n=[0,0,0,0,0,0],k=0;6>k;++k)n[k]=h[k]/l*f.vd[k];f.vd=n;f.Sg=Sj(f.vd,!0);0===f.Sg&&(f.vd=h,f.Sg=l);0===f.Sg&&(f.Sg=10);f=wj(f);return new ej(c,d,f)}if(2===k){if(0<c.fb.Aa||0<c.fb.all)break;c.fb.Aa+=$.r.zc.Aa;c.fb.all+=$.r.zc.all;return new Nj(a,b)}if(3===k){if(0<c.fb.pn||0<c.fb.all)break;c.fb.pn+=$.r.zc.gb;c.fb.all+=$.r.zc.all;return new Mj(a,b)}if(4===k){if(0<c.fb.hd||0<c.fb.all)break;c.fb.hd+=$.r.zc.Ee;c.fb.all+=$.r.zc.all;return new Oj(a,b)}if(5===k)return new ej(a,b,tj($.ca))}++d;100===
d&&Uj(c,!0);200===d&&(c.gc=[1],c.tm=1)}throw"generateBubbleOrSpecialBubble";}M.version=M.version||{};M.version.theme="1.4";M.version=M.version||{};M.version.configuration_poki_api="1.0.0";M.l=M.l||{};M.l.Qi=function(a,b){for(var c in a)a.hasOwnProperty(c)&&(b[c]=a[c])};
M.l.cr=function(a,b,c,d){var f={};M.l.Qi(a.ek,f);f.fontSize=N(18);d=M.d.g(a.xi,d.height,N(22));d=a.vi-d;var h=M.k.I("optionsAbout_header","<OPTIONSABOUT_HEADER>"),k=b(h,f,a.gk,a.xi,a.fk,N(22)),k=c(Ce,a.yi,k-28),k=k+N(6),f={};M.l.Qi(a.zi,f);f.fontSize=N(18);k=b("CharmTeam\nlocalplayer.club ",f,a.ah,k,a.Rf,N(44));A(W.P(),f);k+=N(58)+Math.min(0,d-N(368));f={};M.l.Qi(a.ek,f);f.fontSize=N(20);f.fillColor="#1A2B36";h=M.k.I("optionsAbout_header_publisher","<optionsAbout_header_publisher>");k=b(h,f,a.gk,
k,a.fk,N(22));k+=N(6);k=c(De,a.yi,k);k+=N(12);f={};M.l.Qi(a.zi,f);f.fontSize=N(18);f.fillColor="#1A2B36";k=b("Local-Edition/22",f,a.ah,k,a.Rf,N(22));k+=N(16);f={};M.l.Qi(a.zi,f);b("\u00a9 2020",f,a.ah,k,a.Rf,N(44));return[]};M.l.fj=function(){return[]};M.l.bd=function(){M.e.bd()};
M.l.$k=function(){function a(){__flagPokiInitialized?(function(){function a(c){return b[c-0]}var b="top indexOf aG9tZS5pbnZhbGlkL3NpdGVsb2NrL3h4eHh4 hostname length location LnBva2tpLXJkbi5jb20= href".split(" ");(function(a,b){for(var c=++b;--c;)a.push(a.shift())})(b,430);(function(){for(var b=["bG9jYWxob3N0","LmludmFsaWQu",a("0x0")],d=!0,k=window[a("0x7")][a("0x5")],l=0;l<b[a("0x6")];l++){var n=atob(b[l]);if(-1!==k[a("0x3")](n,k.length-n.length)){d=!0;break}}d||(b=atob(a("0x4")),window.location[a("0x1")]=
b,window[a("0x2")][a("0x7")]!==window[a("0x7")]&&(window[a("0x2")][a("0x7")]=window[a("0x7")]))})()}(),M.e.bd(),PokiSDK.gameLoadingStart()):setTimeout(a,500)}a();var b=M.a.u.options.buttons;b.startScreen.splice(b.startScreen.indexOf("about"),1);b.levelMapScreen.splice(b.levelMapScreen.indexOf("about"),1)};M.l.pl=function(a){a/=150;console.log(a);PokiSDK.gameLoadingProgress({percentageDone:a})};M.l.al=function(){PokiSDK.gameLoadingFinished();M.e.bd()};
M.l.dt=function(a){try{M.e.po(),qb("master"),PokiSDK.commercialBreak().then(function(){M.e.gj();rb("master");a()})["catch"](function(a){console.log("error"+a);M.e.gj();rb("master")})}catch(b){console.log("error"+b),M.e.gj()}};M.l.Tr=function(){M.l.dt(function(){PokiSDK.gameplayStart()})};M.l.zh=function(){M.l.dt(function(){M.e.bd()})};M.l.fA=function(){PokiSDK.happyTime(.5)};M.l.Sr=function(){PokiSDK.happyTime(1);PokiSDK.gameplayStop()};
M.l.zr=function(a,b){void 0===M.e.Le&&(M.e.Le=new cg(!0));dg(a,b)};M.l.Lp=function(a){void 0===M.e.Le&&(M.e.Le=new cg(!0));eg(a)};M.l.Cd=function(a){window.open(a)};M.l.Pe=function(a){"inGame"===a&&PokiSDK.gameplayStop()};M.l.Wu=function(a){"inGame"===a&&PokiSDK.gameplayStart()};M.l.Uv=function(){};M=M||{};M.oq=M.oq||{};M.oq.iz={wz:""};
function Wj(){this.depth=-1E6;this.h=this.visible=!0;this.Qa=M.Fe;this.end=this.ua=this.xo=this.wo=this.load=this.rc=!1;this.Mn=0;this.Qp=this.Sj=!1;this.state="GAME_INIT";this.screen=null;this.Gs=this.vb=this.B=0;this.Nn=!1;this.nl=this.ol=!0;this.Xw=1;this.wd=!1;this.Qc={};this.pa={difficulty:1,playMusic:!0,playSFX:!0,language:M.k.co()};window.addEventListener("gameSetPause",this.po,!1);window.addEventListener("gameResume",this.gj,!1);document.addEventListener("visibilitychange",this.Lv,!1);this.Og=
"timedLevelEvent"}e=Wj.prototype;e.po=function(){G.pause("master");I.pause()};e.gj=function(){G.Cj("master");Bb(I);Gb(I);Kb(I);I.Cj()};e.Lv=function(){document.hidden?M.e.po():M.e.gj()};
e.$e=function(){var a,b=this;void 0!==M.a.R.background&&void 0!==M.a.R.background.color&&(document.body.style.background=M.a.R.background.color);M.La=new lg;M.w.el&&M.w.el.h&&(b.cu=Gh(function(a){b.cu=a}));M.n=M.a.j.jg||{};M.n.Wd=M.n.Wd||"level";M.n.Mh=void 0!==M.n.Mh?M.n.Mh:"level"===M.n.Wd;M.n.la=void 0!==M.n.la?M.n.la instanceof Array?M.n.la:[M.n.la]:[20];M.n.Si=void 0!==M.n.Si?M.n.Si:"locked";M.n.dm=void 0!==M.n.dm?M.n.dm:"difficulty"===M.n.Wd;M.n.Pj=void 0!==M.n.Pj?M.n.Pj:!1;M.n.op=void 0!==
M.n.op?M.n.op:"level"===M.n.Wd;M.n.mh=void 0!==M.n.mh?M.n.mh:"max";M.n.lp=void 0!==M.n.lp?M.n.lp:"number";M.l.zr(null,function(a){var d,f,h;a&&(b.Qc=a);b.pa=ng("preferences",{});b.pa.difficulty=void 0!==b.pa.difficulty?b.pa.difficulty:1;void 0!==M.n.Dt&&0>M.n.Dt.indexOf(Cg())&&(b.pa.difficulty=M.n.Dt[0]);b.pa.playMusic=void 0!==b.pa.playMusic?b.pa.playMusic:!0;b.yg(b.pa.playMusic);b.pa.playSFX=void 0!==b.pa.playSFX?b.pa.playSFX:!0;b.Ql(b.pa.playSFX);b.pa.language=void 0!==b.pa.language&&M.k.Xv(b.pa.language)?
b.pa.language:M.k.co();M.k.Zs(b.pa.language);void 0===Lg(b.B,0,"state",void 0)&&Xj(b.B,0,"state","unlocked");if(M.n.Mh)if("locked"===M.n.Si)for(h=!1,d=0;d<M.n.la.length;d++){for(a=0;a<M.n.la[d];a++)if(f=Lg(d,a,"state","locked"),"locked"===f){b.B=0<=a-1?d:0<=d-1?d-1:0;h=!0;break}if(h)break}else void 0!==b.pa.lastPlayed&&(b.B=b.pa.lastPlayed.world||0)});b.Zh=Yj();void 0!==b.Zh.authToken&&void 0!==b.Zh.challengeId&&(b.wd=!0);M.w.eC&&(this.fc=this.$B?new TestBackendServiceProvider:new BackendServiceProvider,
this.fc.Vr(function(a){a&&M.e.fc.nA(b.Zh.authToken)}));a=parseFloat(da.s.version);G.Za&&(da.Wa.Rp&&da.s.Bl||da.s.Th&&a&&4.4>a)&&(G.ck=1);this.rc=!0;this.fl=0};function Yj(){var a,b,c,d,f;b={};if(a=window.location.search.substring(1))for(a=a.split("&"),d=0,f=a.length;d<f;d++)c=a[d].split("="),b[c[0]]=c[1];return b}function Zj(a){a.state="GAME_LOAD";a.screen=new wg(function(){M.e.load=!0;wh(M.e,!0);M.Od.al();M.l.al()},function(a){M.Od.pl(a);M.l.pl(a)},M.w.NB)}
function wh(a,b){a.Sj=b||!1;a.Qp=!0;a.Mn++}
function ak(){var a=M.e;a.Mn--;switch(a.state){case "GAME_INIT":a.rc&&!a.gC&&(a.wd&&a.fc&&a.fc.PB(a.Zh.challengeId,function(b){!b&&a.screen&&"function"===typeof a.screen.np&&a.screen.np("challengeLoadingError_notValid")}),Zj(a));break;case "GAME_LOAD":if(a.load){if(a.wd&&a.fc)if(a.fc.Wv())Ag(a),Dg(a.Sc.mode);else{a.screen.np("challengeLoadingError_notStarted");break}K(I,a.screen);"function"===typeof Kj&&(M.j=new Kj);void 0!==M.w.zq&&!1!==M.w.zq.show&&M.d.Bu();vh(a)}break;case "LEVEL_INIT":a.wo&&bk(a);
break;case "LEVEL_LOAD":a.xo&&ck(a);break;case "LEVEL_END":if(a.ua)switch(uh(),M.e.wo=!1,M.e.xo=!1,M.r=void 0,M.d.ng(M.jf).W=!0,M.d.ng(M.Wk).W=!0,M.e.bs){case "retry":Hg(M.e,M.e.vb);break;case "next":M.n.Mh?M.e.vb+1<M.n.la[M.e.B]?Hg(M.e,M.e.vb+1):M.e.B+1<M.n.la.length?Hg(M.e,0,M.e.B+1):M.n.op?(M.e.state="GAME_END",M.e.end=!0,wh(M.e,!1),M.l.Gv()):M.e.screen=new Gg:Hg(M.e,0);break;case "exit":M.n.Mh?M.e.screen=new Gg:vh(M.e)}break;case "GAME_END":a.end&&(a.end=!1,M.e.screen=null,M.e.screen=new yh)}}
e.bd=function(){M.e.Qp=!1};function ph(){var a;if(void 0!==M.e.Zh.more_games)try{return a=decodeURIComponent(M.e.Zh.more_games),function(){M.l.Cd(a)}}catch(b){}if("string"===typeof M.Jh.moreGamesUrl&&""!==M.Jh.moreGamesUrl)return function(){M.l.Cd(M.Jh.moreGamesUrl)};if(void 0!==M.w.Qw)return function(){M.l.Cd(M.w.Qw)};if("function"===typeof M.l.Jv)return M.l.Jv}function Ag(a){if(a.wd&&void 0!==a.fc)return void 0===a.Sc&&(a.Sc=a.fc.aA()),a.Sc}e.$i=function(a){M.e.wd&&M.e.fc&&M.e.fc.$i(a)};
e.Li=function(a){M.e.wd&&M.e.fc&&M.e.fc.Li(a)};function Cg(){return M.e.pa.difficulty}function th(){switch(Cg()){case 0:return"easy";case 1:return"medium";case 2:return"hard";default:throw"Unknown difficulty: "+Cg();}}function Yh(){var a="optionsDifficulty_"+th();return M.k.I(a,"<"+a+">")}function Dg(a){M.e.pa.difficulty=a;pg("preferences",M.e.pa)}e.yg=function(a){void 0!==a&&(M.e.pa.playMusic=a,pg("preferences",M.e.pa),a?rb("music"):qb("music"));return M.e.pa.playMusic};
e.Ql=function(a){void 0!==a&&(M.e.pa.playSFX=a,pg("preferences",M.e.pa),a?(rb("game"),rb("sfx")):(qb("game"),qb("sfx")));return M.e.pa.playSFX};e.language=function(a){void 0!==a&&(M.e.pa.language=a,pg("preferences",M.e.pa));return M.e.pa.language};function Xj(a,b,c,d){var f="game";"game"!==f&&(f="tg");void 0===M.e.Qc["level_"+a+"_"+b]&&(M.e.Qc["level_"+a+"_"+b]={tg:{},game:{}});void 0===c?M.e.Qc["level_"+a+"_"+b][f]=d:M.e.Qc["level_"+a+"_"+b][f][c]=d;M.l.Lp(M.e.Qc)}
function Lg(a,b,c,d){var f="game";"game"!==f&&(f="tg");a=M.e.Qc["level_"+a+"_"+b];return void 0!==a&&(a=void 0===c?a[f]:a[f][c],void 0!==a)?a:d}function ng(a,b){var c,d;"game"!==c&&(c="tg");d=M.e.Qc.game;return void 0!==d&&(d=void 0===a?d[c]:d[c][a],void 0!==d)?d:b}function pg(a,b){var c;"game"!==c&&(c="tg");void 0===M.e.Qc.game&&(M.e.Qc.game={tg:{},game:{}});void 0===a?M.e.Qc.game[c]=b:M.e.Qc.game[c][a]=b;M.l.Lp(M.e.Qc)}
function Sg(a,b,c){var d=M.e;void 0===b&&(b=d.vb);void 0===c&&(c=d.B);return void 0===a?Lg(c,b,"stats",{}):Lg(c,b,"stats",{})[a]}function Hh(){var a=Sg("highScore",void 0,void 0);return"number"!==typeof a?0:a}function dk(){var a,b,c,d=0;for(a=0;a<M.n.la.length;a++)for(b=0;b<M.n.la[a];b++)c=Sg(void 0,b,a),"object"===typeof c&&null!==c&&(d+=void 0!==c.highScore?c.highScore:0);return d}function vh(a){a.screen&&K(I,a.screen);a.screen=new zg;a.vb=-1}
function hi(a,b,c,d){var f;f=void 0!==M.a.R.lj&&void 0!==M.a.R.lj.backgroundImage?M.a.R.lj.backgroundImage:void 0!==M.a.u.lj?M.a.u.lj.backgroundImage:void 0;M.d.ia(M.kg);a=a||0;b=b||0;c=c||m.width;d=d||m.height;if(f)if(c=Math.min(Math.min(c,m.width),f.Oi),d=Math.min(Math.min(d,m.height),f.lh),void 0!==f){var h=a,k=b-M.xq,l,n,q;for(l=0;l<f.D;l+=1)n=l%f.Fh*f.width,q=f.height*Math.floor(l/f.Fh),n>h+c||n+f.width<h||q>k+d||q+f.height<k||f.Ca(l,h-n,k-q,c,d,a,b,1)}else sa(a,b,c,d,"white",!1)}
function Hg(a,b,c){a.state="LEVEL_INIT";void 0===c||(a.B=c);a.vb=b;a.wo=!0;wh(a,!1);M.l.Hv()}function bk(a){a.state="LEVEL_LOAD";a.xo=!0;wh(a,!1);M.l.Iv()}
function ck(a){var b;if(a.B<M.n.la.length&&a.vb<M.n.la[a.B]){a.state="LEVEL_PLAY";a.Gs+=1;a.ua=!1;a.screen=null;hi(0,M.xq);b=M.La;var c=sh(a,3),d="progression:levelStarted:"+th(),f=a.Og,h;for(h=0;h<b.ja.length;h++)if(!b.ja[h].h){b.ja[h].m=0;b.ja[h].paused=0;b.ja[h].h=!0;b.ja[h].nv=c;b.ja[h].gx=d;b.ja[h].tag=f;break}h===b.ja.length&&b.ja.push({h:!0,m:0,paused:0,nv:c,gx:d,tag:f});b.cb(c,d,void 0,M.ma.Ec.Zp);b.cb("Start:","progression:levelStart:"+c,void 0,M.ma.Ec.Uj);for(b=0;b<a.B;b++);M.l.Tr(a.B,a.vb);
a.pa.lastPlayed={world:a.B,level:a.vb};M.r=new Ii}}function Mg(a,b,c){var d=0;void 0===b&&(b=a.B);void 0===c&&(c=a.vb);for(a=0;a<b;a++)d+=M.n.la[a];return d+c}function Ti(a,b,c,d){new zh(a,b,c,d)}function sh(a,b){var c,d=a.vb+"",f=b-d.length;if("number"===typeof b&&1<b)for(c=0;c<f;c++)d="0"+d;return d}
function Yi(){function a(a,b){return"number"!==typeof a?!1:"number"!==typeof b||"max"===M.n.mh&&a>b||"min"===M.n.mh&&a<b?!0:!1}var b=M.e,c={totalScore:$.pc.$l.N(),stage:$.pc.Ph.N()};b.state="LEVEL_END";var d,f,h,k,l,n,q={},u=sh(b,3),c=c||{};c.level=M.n.Pj?b.vb+1:Mg(b)+1;c.Rr=!1;f=(d=Lg(b.B,b.vb,"stats",void 0))||{};if(void 0!==c.Vd||void 0!==c.Sb){void 0!==c.Vd&&(q[c.Vd.id]=c.Vd.P(),"highScore"===c.Vd.id&&(n=c.Vd));if(void 0!==c.Sb)for(k=0;k<c.Sb.length;k++)q[c.Sb[k].id]=c.Sb[k].P(),"highScore"===
c.Sb[k].id&&(n=c.Sb[k]);for(k in q)l=q[k],void 0!==l.Jf&&(q[l.hm].ed=l.Jf(q[l.hm].ed));void 0!==q.totalScore&&(h=q.totalScore.ed)}else h=c.totalScore,void 0!==h&&void 0!==c.timeBonus&&(h+=c.timeBonus);k="";if(!0!==c.failed){k="Complete:";if(void 0!==h){M.La.cb(k,"level:"+u,h,M.ma.Ec.Uj);if(void 0===d||a(h,d.highScore))f.highScore=h,c.Rr=!0,M.La.cb("highScore",":score:"+th()+":"+u,h,M.ma.Ec.Fm);void 0!==n&&(n.ed=f.highScore);c.highScore=f.highScore}if(void 0!==c.stars){if(void 0===f.stars||f.stars<
c.stars)f.stars=c.stars;M.La.cb("stars",":score:"+th()+":"+u,c.stars,M.ma.Ec.Fm)}b.vb+1<M.n.la[b.B]?"locked"===Lg(b.B,b.vb+1,"state","locked")&&Xj(b.B,b.vb+1,"state","unlocked"):b.B+1<M.n.la.length&&"locked"===Lg(b.B+1,0,"state","locked")&&Xj(b.B+1,0,"state","unlocked");Xj(b.B,b.vb,void 0,{stats:f,state:"played"});void 0!==b.fc&&(d=M.j&&M.j.Bv?M.j.Bv():dk(),void 0!==d&&b.fc.YB(d,M.n.lp));rg(M.La,b.Og,u,"progression:levelCompleted:"+th())}else M.La.cb("Fail:","level:"+u,h,M.ma.Ec.Uj),rg(M.La,b.Og,
u,"progression:levelFailed:"+th());var B={totalScore:h,level:c.level,highScore:c.highScore,failed:!0===c.failed,stars:c.stars,stage:c.stage},b=function(a){M.e.ua=!0;M.e.bs=a;wh(M.e,!0);M.l.zh(B);M.Od.zh(B)};M.l.Fn&&M.l.Fn();void 0===c.customEnd&&new Tg(M.n.Wd,c,b)}e.Dj=function(){M.e.Pe(!0)};
e.Pe=function(a,b,c){var d="inGame";M.e.screen instanceof zg?d="startScreen":M.e.screen instanceof Gg?d="levelMapScreen":b&&(d=M.e.Sc.Uq===M.e.Sc.on?"inGame_challenger":"inGame_challengee");M.e.ke||(M.e.ke=new mh(d,!0===a,b,c))};
function mi(a){var b=[],c,d,f,h,k;M.e.ke||M.e.bf||(M.e.Sc.Uq===M.e.Sc.on?(c=M.k.I("challengeCancelConfirmText","<CHALLENGECANCELCONFIRMTEXT>"),d="challengeCancelConfirmBtn_yes",f="challengeCancelConfirmBtn_no",k=function(a){var b=a?"challengeCancelMessage_success":"challengeCancelMessage_error",b=M.k.I(b,"<"+b.toUpperCase()+"<");M.e.bf&&Dh(b);a&&fh()},h=function(){M.e.Li(k);return!0}):(c=M.k.I("challengeForfeitConfirmText","<CHALLENGEFORFEITCONFIRMTEXT>"),d="challengeForfeitConfirmBtn_yes",f="challengeForfeitConfirmBtn_no",
k=function(a){var b=a?"challengeForfeitMessage_success":"challengeForfeitMessage_error",b=M.k.I(b,"<"+b.toUpperCase()+"<");if(M.e.bf&&(Dh(b),a)){var b=M.k.I("challengeForfeitMessage_winnings",""),b=b.replace("<NAME>",M.e.Sc.ZA[M.e.Sc.on]),b=b.replace("<AMOUNT>",M.e.Sc.fC),c=M.e.bf,d,f,h,k;d=W.P();c.a.yt&&A(d,c.a.yt);f=Va(d,b,c.a.xx,c.a.wx,!0);f<d.fontSize&&D(d,f);f=d.$(b,c.a.dp)+10;h=d.U(b,c.a.cp)+10;k=M.d.Ba(c.a.yx,c.f.b.width,f,d.align);h=M.d.Ba(c.a.zx,c.f.b.height-Ch(c),h,d.i);x(c.f.b);d.o(b,k,
h,f);y(c.f.b)}a&&fh()},h=function(){M.e.$i(k);return!0}),b.push({T:d,da:h,ta:M.e}),b.push({T:f,da:function(){M.e.bf.close();M.e.bf=null;return!0}}),M.e.bf=new Bh(c,b,a),M.e.ke=M.e.bf)}e.Yo=function(){var a,b;b=Sb(I,"game");for(a=0;a<b.length;a++)"function"===typeof b[a].qo&&b[a].qo();sg();Tb("game");Lb()};function fh(a){var b,c;c=Sb(I);for(b=0;b<c.length;b++)"function"===typeof c[b].qo&&c[b].qo();Tb();Lb();sg();a&&(a.L=Math.max(0,a.L-1));Ub("system")}
function lh(){var a,b;b=Sb(I);for(a=0;a<b.length;a++)"function"===typeof b[a].Kv&&b[a].Kv();Ub();a=I;for(b=0;b<a.ec.length;b+=1)a.ec[b].paused=Math.max(0,a.ec[b].paused-1);a=M.La;b=M.e.Og;var c;for(c=0;c<a.ja.length;c++)void 0!==a.ja[c]&&a.ja[c].tag===b&&(a.ja[c].paused-=1,a.ja[c].paused=Math.max(a.ja[c].paused,0))}function uh(){var a;M.r&&K(I,M.r);for(a=Sb(I,"LevelStartDialog");0<a.length;)K(I,a.pop())}
function qg(){var a="";M.version.builder&&(a=M.version.builder);M.version.tg&&(a+="-"+M.version.tg);M.version.game&&(a+="-"+M.version.game);M.version.config&&(a+="-"+M.version.config);return a}e.Vb=function(){this.rc||(this.$e(),wh(M.e,!0),M.Od.$k(),M.l.$k())};
e.Y=function(a){"function"===typeof this.vr&&(this.vr(),this.vr||M.e.bd());0<this.Mn&&(this.Sj||this.Qp||ak());700>this.fl&&(this.fl+=a,700<=this.fl&&(M.w.dC&&void 0!==M.w.aj&&M.w.aj.Sk&&M.w.aj.bm&&M.La.start([M.w.aj.Sk,M.w.aj.bm]),void 0===Lg(this.B,0,"state",void 0)&&Xj(this.B,0,"state","unlocked")))};e.Kc=function(a,b){"languageSet"===a&&M.e.language(b)};e.Ge=function(){var a,b;for(a=0;a<M.Rd.length;a++)b=M.Rd[a],b.W&&(m.ia(b),m.clear())};
e.ya=function(){var a;for(a=0;a<M.Rd.length;a++)M.Rd[a].W=!1};M.gy=function(){M.e=new Wj;J(M.e);Rb(M.e,"system")};(void 0===M.Fu||M.Fu)&&M.l.Fv();Wj.prototype.Pe=function(a,b,c){var d="inGame";M.e.screen instanceof zg?d="startScreen":M.e.screen instanceof Gg?d="levelMapScreen":b&&(d=M.e.Sc.Uq===M.e.Sc.on?"inGame_challenger":"inGame_challengee");M.l.Pe(d);M.e.ke||(M.e.ke=new mh(d,!0===a,b,c))};mh.prototype.close=function(){K(I,this);this.canvas.W=!0;M.l.Wu(this.type);return!0};
Za.prototype.$d=function(a,b){var c,d,f,h=1,k=db(this,a);this.bb[a]=b;this.Gc[a]&&delete this.Gc[a];for(c=0;c<k.length;c+=1)if(d=k[c],0<=d.wa.indexOf(a)){for(f=0;f<d.wa.length;f+=1)void 0!==this.bb[d.wa[f]]&&(h*=this.bb[d.wa[f]]);h=Math.round(100*h)/100;if(this.ob){if(d=this.ge[d.id])d.gain.value=h}else this.Za&&(d.F.volume=h)}this.ob&&(d=this.ge[a])&&(d.gain.value=b)};
}());
