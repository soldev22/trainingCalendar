const mongoose = require('mongoose');

const BlackoutSchema = new mongoose.Schema(
  {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    portion: { type: String, enum: ['full', 'am', 'pm'], required: true },
    reason: { type: String, default: 'Blackout' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Blackout', BlackoutSchema);
