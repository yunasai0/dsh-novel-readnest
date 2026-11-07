import BookCover from '@/components/BookCover';
import type { Book } from '@/types/book';
import { MdArrowForward } from 'react-icons/md';
import { getProgressPercentage } from '../utils/libraryUtils';

export default function StudyContinueReading({
  book,
  onOpenBook,
}: {
  book: Book;
  onOpenBook: (book: Book) => void;
}) {
  const percent = getProgressPercentage(book);

  return (
    <div className='study-bookshelf-intro' lang='zh-CN'>
      <section className='study-continue' aria-labelledby='study-continue-title'>
        <h2 id='study-continue-title' className='study-shelf-label'>
          继续阅读 <i lang='en'>Continue reading</i>
        </h2>
        <article className='study-continue-card'>
          <div className='study-continue-cover' aria-hidden='true'>
            <BookCover book={book} showSpine />
          </div>
          <div className='study-continue-copy'>
            <h3>{book.title}</h3>
            {book.author && <p className='study-continue-author'>{book.author}</p>}
            {percent !== null && Number.isFinite(percent) ? (
              <div className='study-continue-progress'>
                <progress aria-label='阅读进度' value={percent} max={100} />
                <div>
                  <span>已读 {percent}%</span>
                  {book.progress && <span>{book.progress.join(' / ')} 页</span>}
                </div>
              </div>
            ) : (
              <p className='study-continue-author'>尚无阅读进度</p>
            )}
            <button
              type='button'
              className='study-primary-button study-continue-button'
              aria-label={`继续阅读：${book.title}`}
              onClick={() => onOpenBook(book)}
            >
              继续阅读 <MdArrowForward aria-hidden='true' />
            </button>
          </div>
        </article>
      </section>
      <h2 className='study-shelf-label study-collection-label'>
        藏书 <i lang='en'>The collection</i>
      </h2>
    </div>
  );
}
