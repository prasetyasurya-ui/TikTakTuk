import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/pages.css';
import artistApi from '../../services/api/artistApi';
import ArtistForm from '../../components/Artist/ArtistForm';

const ArtistManagementPage = () => {
  const navigate = useNavigate();
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingArtist, setEditingArtist] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Fetch artists on component mount
  useEffect(() => {
    fetchArtists();
  }, []);

  const fetchArtists = async () => {
    setLoading(true);
    try {
      const data = await artistApi.getAllArtists();
      setArtists(data || []);
    } catch (error) {
      console.error('Error fetching artists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingArtist(null);
    setShowModal(true);
  };

  const handleOpenEditModal = (artist) => {
    setEditingArtist(artist);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingArtist(null);
  };

  const handleSave = async (formData) => {
    try {
      if (editingArtist) {
        await artistApi.updateArtist(editingArtist.artist_id, formData);
      } else {
        await artistApi.createArtist(formData);
      }
      handleCloseModal();
      fetchArtists();
    } catch (error) {
      console.error('Error saving artist:', error);
    }
  };

  const handleDelete = async (artistId) => {
    try {
      await artistApi.deleteArtist(artistId);
      setDeleteConfirm(null);
      fetchArtists();
    } catch (error) {
      console.error('Error deleting artist:', error);
    }
  };

  const filteredArtists = artists.filter(artist =>
    artist.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (artist.genre && artist.genre.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Manajemen Artist</h1>
        <p>Kelola data artis yang tampil di platform TikTakTuk</p>
      </div>

      <div className="page-content">
        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Artist</h3>
            <p className="stat-value">{artists.length}</p>
          </div>
          <div className="stat-card">
            <h3>Genre Unik</h3>
            <p className="stat-value">
              {new Set(artists.map(a => a.genre)).size}
            </p>
          </div>
          <div className="stat-card">
            <h3>Dalam Event</h3>
            <p className="stat-value">{artists.length > 0 ? artists.length : 0}</p>
          </div>
        </div>

        {/* Search and Add Button */}
        <div className="page-actions">
          <div className="search-box">
            <input
              type="text"
              placeholder="Cari nama artist atau genre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={handleOpenCreateModal}>
            + Tambah Artist
          </button>
        </div>

        {/* Artists Table */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nama Artist</th>
                <th>Genre</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="3" className="text-center">Loading...</td>
                </tr>
              ) : filteredArtists.length === 0 ? (
                <tr>
                  <td colSpan="3" className="text-center">Tidak ada data artist</td>
                </tr>
              ) : (
                filteredArtists.map((artist) => (
                  <tr key={artist.artist_id}>
                    <td>{artist.name}</td>
                    <td>{artist.genre || '-'}</td>
                    <td className="action-buttons">
                      <button
                        className="btn btn-sm btn-edit"
                        onClick={() => handleOpenEditModal(artist)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-delete"
                        onClick={() => setDeleteConfirm(artist)}
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <ArtistForm
          artist={editingArtist}
          onSave={handleSave}
          onClose={handleCloseModal}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: '#dc3545' }}>Hapus Artist</h2>
            <p>Apakah Anda yakin ingin menghapus artist ini? Tindakan ini tidak dapat dibatalkan.</p>
            <p style={{ fontWeight: 'bold' }}>ID: {deleteConfirm.artist_id}</p>
            <p style={{ fontWeight: 'bold' }}>Nama: {deleteConfirm.name}</p>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setDeleteConfirm(null)}
              >
                Batal
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleDelete(deleteConfirm.artist_id)}
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArtistManagementPage;
