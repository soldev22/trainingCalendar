const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    reason: { type: String, enum: ['Training', 'Meeting'], required: true },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['provisional', 'confirmed'],
      default: 'provisional',
      required: true,
    },
    // Local time-of-day slots in 24h format HH:MM
    startTime: { type: String },
    endTime: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Event', EventSchema);
