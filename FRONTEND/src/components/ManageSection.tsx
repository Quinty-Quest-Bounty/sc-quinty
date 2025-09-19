import React from 'react';

interface ManageSectionProps {
  airdrops: any[];
  address: string | undefined;
  selectedManageTab: 'verify' | 'finalize' | 'cancel';
  setSelectedManageTab: (tab: 'verify' | 'finalize' | 'cancel') => void;
  selectedAirdropForManage: any;
  setSelectedAirdropForManage: (airdrop: any) => void;
  verificationForm: any;
  setVerificationForm: (form: any) => void;
  verifyEntry: () => void;
  finalizeAirdrop: (id: number) => void;
  cancelAirdrop: (id: number) => void;
  formatSTT: (value: bigint) => string;
  formatTimeLeft: (timestamp: number) => string;
  setActiveTab: (tab: string) => void;
}

export const ManageSection: React.FC<ManageSectionProps> = ({
  airdrops,
  address,
  selectedManageTab,
  setSelectedManageTab,
  selectedAirdropForManage,
  setSelectedAirdropForManage,
  verificationForm,
  setVerificationForm,
  verifyEntry,
  finalizeAirdrop,
  cancelAirdrop,
  formatSTT,
  formatTimeLeft,
  setActiveTab,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Campaign Management</h3>
        <div className="bg-blue-50 px-4 py-2 rounded-lg">
          <p className="text-sm text-blue-800">
            Select campaigns to manage entries, verify submissions, and handle administrative tasks.
          </p>
        </div>
      </div>

      {/* Management Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'verify', label: 'Verify Entries', icon: '✓' },
            { key: 'finalize', label: 'Finalize Campaigns', icon: '🏁' },
            { key: 'cancel', label: 'Cancel Campaigns', icon: '✕' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedManageTab(tab.key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                selectedManageTab === tab.key
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* My Campaigns Overview */}
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="text-lg font-semibold mb-4">My Campaigns</h4>

        {airdrops.filter((a) => a.creator === address).length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 text-4xl mb-4">📢</div>
            <p className="text-gray-600 mb-2">You haven't created any airdrop campaigns yet.</p>
            <button
              onClick={() => setActiveTab('create')}
              className="text-primary-600 hover:text-primary-500"
            >
              Create your first campaign →
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {airdrops
              .filter((a) => a.creator === address)
              .map((airdrop) => (
                <div
                  key={airdrop.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                    selectedAirdropForManage?.id === airdrop.id
                      ? "border-primary-500 bg-primary-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => setSelectedAirdropForManage(airdrop)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h5 className="font-medium text-lg">
                          {airdrop.title || `Campaign #${airdrop.id}`}
                        </h5>
                        <div
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            airdrop.resolved
                              ? "bg-green-100 text-green-800"
                              : airdrop.cancelled
                              ? "bg-red-100 text-red-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {airdrop.resolved ? "Completed" : airdrop.cancelled ? "Cancelled" : "Active"}
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Progress:</span>
                          <div className="font-medium">{airdrop.qualifiersCount}/{airdrop.maxQualifiers}</div>
                        </div>
                        <div>
                          <span className="text-gray-500">Reward:</span>
                          <div className="font-medium">{formatSTT(airdrop.perQualifier)} STT</div>
                        </div>
                        <div>
                          <span className="text-gray-500">Total Budget:</span>
                          <div className="font-medium">{formatSTT(airdrop.totalAmount)} STT</div>
                        </div>
                        <div>
                          <span className="text-gray-500">Deadline:</span>
                          <div className="font-medium">{formatTimeLeft(airdrop.deadline)}</div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {selectedAirdropForManage?.id === airdrop.id && (
                        <div className="text-primary-600 text-sm font-medium">Selected</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Management Actions Based on Selected Tab */}
      {selectedAirdropForManage && (
        <div className="bg-white rounded-lg shadow p-6">
          {selectedManageTab === 'verify' && (
            <div>
              <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                ✓ Verify Entries for "{selectedAirdropForManage.title || `Campaign #${selectedAirdropForManage.id}`}"
              </h4>

              <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <h5 className="font-medium text-blue-900 mb-2">How to verify entries:</h5>
                <ol className="text-sm text-blue-800 space-y-1">
                  <li>1. Review the submission proof (IPFS link)</li>
                  <li>2. Check if it meets the campaign requirements</li>
                  <li>3. Select approve/reject and add feedback</li>
                  <li>4. Submit verification</li>
                </ol>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Entry ID to Verify
                  </label>
                  <input
                    type="number"
                    placeholder="Enter entry index (0, 1, 2...)"
                    value={verificationForm.entryId || ""}
                    onChange={(e) =>
                      setVerificationForm({
                        ...verificationForm,
                        airdropId: selectedAirdropForManage.id,
                        entryId: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Verification Decision
                  </label>
                  <select
                    value={verificationForm.status}
                    onChange={(e) =>
                      setVerificationForm({
                        ...verificationForm,
                        status: parseInt(e.target.value),
                      })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value={1}>✅ Approve Entry</option>
                    <option value={2}>❌ Reject Entry</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Feedback Message (Optional)
                </label>
                <textarea
                  placeholder="Add feedback for the participant..."
                  value={verificationForm.feedback}
                  onChange={(e) =>
                    setVerificationForm({
                      ...verificationForm,
                      feedback: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={3}
                />
              </div>

              <button
                onClick={verifyEntry}
                disabled={verificationForm.entryId === undefined}
                className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 font-medium"
              >
                Submit Verification
              </button>
            </div>
          )}

          {selectedManageTab === 'finalize' && (
            <div>
              <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                🏁 Finalize "{selectedAirdropForManage.title || `Campaign #${selectedAirdropForManage.id}`}"
              </h4>

              <div className="bg-yellow-50 rounded-lg p-4 mb-6">
                <h5 className="font-medium text-yellow-900 mb-2">⚠️ About finalizing campaigns:</h5>
                <ul className="text-sm text-yellow-800 space-y-1">
                  <li>• Finalizing will distribute rewards to all approved entries</li>
                  <li>• Unused funds will be refunded to you</li>
                  <li>• This action cannot be undone</li>
                  <li>• You can only finalize after the deadline or when all slots are filled</li>
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <h6 className="font-medium mb-2">Campaign Status</h6>
                  <div className="space-y-2 text-sm">
                    <div>Approved Entries: <span className="font-medium">{selectedAirdropForManage.qualifiersCount}</span></div>
                    <div>Max Qualifiers: <span className="font-medium">{selectedAirdropForManage.maxQualifiers}</span></div>
                    <div>Deadline: <span className="font-medium">{formatTimeLeft(selectedAirdropForManage.deadline)}</span></div>
                    <div>Status: <span className={`font-medium ${
                      selectedAirdropForManage.resolved ? 'text-green-600' :
                      selectedAirdropForManage.cancelled ? 'text-red-600' : 'text-blue-600'
                    }`}>
                      {selectedAirdropForManage.resolved ? 'Completed' :
                       selectedAirdropForManage.cancelled ? 'Cancelled' : 'Active'}
                    </span></div>
                  </div>
                </div>
                <div>
                  <h6 className="font-medium mb-2">Financial Summary</h6>
                  <div className="space-y-2 text-sm">
                    <div>Total Escrowed: <span className="font-medium">{formatSTT(selectedAirdropForManage.totalAmount)} STT</span></div>
                    <div>Will Distribute: <span className="font-medium">{formatSTT(selectedAirdropForManage.perQualifier * BigInt(selectedAirdropForManage.qualifiersCount))} STT</span></div>
                    <div>Your Refund: <span className="font-medium text-green-600">{formatSTT(selectedAirdropForManage.totalAmount - (selectedAirdropForManage.perQualifier * BigInt(selectedAirdropForManage.qualifiersCount)))} STT</span></div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => finalizeAirdrop(selectedAirdropForManage.id)}
                disabled={selectedAirdropForManage.resolved || selectedAirdropForManage.cancelled}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {selectedAirdropForManage.resolved ? 'Already Finalized' :
                 selectedAirdropForManage.cancelled ? 'Campaign Cancelled' : 'Finalize Campaign'}
              </button>
            </div>
          )}

          {selectedManageTab === 'cancel' && (
            <div>
              <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                ✕ Cancel "{selectedAirdropForManage.title || `Campaign #${selectedAirdropForManage.id}`}"
              </h4>

              <div className="bg-red-50 rounded-lg p-4 mb-6">
                <h5 className="font-medium text-red-900 mb-2">⚠️ About cancelling campaigns:</h5>
                <ul className="text-sm text-red-800 space-y-1">
                  <li>• You can only cancel campaigns with no approved entries</li>
                  <li>• All escrowed funds will be refunded to you</li>
                  <li>• This action cannot be undone</li>
                  <li>• Participants will no longer be able to submit entries</li>
                </ul>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h6 className="font-medium mb-2">Campaign Details</h6>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>Approved Entries: <span className="font-medium">{selectedAirdropForManage.qualifiersCount}</span></div>
                  <div>Total Escrowed: <span className="font-medium">{formatSTT(selectedAirdropForManage.totalAmount)} STT</span></div>
                </div>
              </div>

              <button
                onClick={() => cancelAirdrop(selectedAirdropForManage.id)}
                disabled={selectedAirdropForManage.qualifiersCount > 0 || selectedAirdropForManage.resolved || selectedAirdropForManage.cancelled}
                className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 font-medium"
              >
                {selectedAirdropForManage.cancelled ? 'Already Cancelled' :
                 selectedAirdropForManage.resolved ? 'Campaign Completed' :
                 selectedAirdropForManage.qualifiersCount > 0 ? 'Cannot Cancel (Has Approved Entries)' :
                 'Cancel Campaign & Refund'}
              </button>
            </div>
          )}
        </div>
      )}

      {!selectedAirdropForManage && airdrops.filter((a) => a.creator === address).length > 0 && (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <div className="text-gray-400 text-3xl mb-2">👆</div>
          <p className="text-gray-600">Select a campaign above to manage its entries and settings</p>
        </div>
      )}
    </div>
  );
};